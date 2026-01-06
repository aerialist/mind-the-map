import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import type { NodeMap } from '../types';
import { getIconDefinition, sortIconsByDisplayOrder } from '../types';

/**
 * Export the current view as a PDF
 * @param viewMode The current view mode ('mindmap' or 'outline')
 * @param nodes The current node map
 * @param rootId The root node ID
 * @param visibleNodeIds Set of visible node IDs (respects filters and collapse state)
 */
export async function exportToPDF(
  viewMode: 'mindmap' | 'outline',
  nodes: NodeMap,
  rootId: string,
  visibleNodeIds: Set<string>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Show save dialog
    const filePath = await save({
      filters: [{
        name: 'PDF',
        extensions: ['pdf']
      }],
      defaultPath: 'mindmap.pdf'
    });

    if (!filePath) {
      return { success: false, error: 'Save cancelled' };
    }

    let pdfBlob: Blob;

    if (viewMode === 'mindmap') {
      pdfBlob = await exportMindmapToPDF();
    } else {
      pdfBlob = await exportOutlineToPDF(nodes, rootId, visibleNodeIds);
    }

    // Convert blob to base64 for Tauri file write
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64 in chunks to avoid stack overflow on large PDFs
    let base64 = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      base64 += String.fromCharCode(...chunk);
    }
    base64 = btoa(base64);

    // Write file using Tauri command
    await invoke('save_pdf', { path: filePath, content: base64 });

    return { success: true };
  } catch (error) {
    console.error('PDF export error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Export mindmap canvas as PDF
 */
async function exportMindmapToPDF(): Promise<Blob> {
  const canvasContainer = document.querySelector('.pixi-canvas-container') as HTMLElement;
  
  if (!canvasContainer) {
    throw new Error('Canvas container not found');
  }

  // Find the canvas element
  const canvas = canvasContainer.querySelector('canvas');
  if (!canvas) {
    throw new Error('Canvas not found');
  }

  // Capture the canvas as an image
  // Note: html2canvas types are incomplete, using explicit cast for options
  const canvasImage = await html2canvas(canvasContainer, {
    background: '#1a1a2e',
    logging: false,
  } as Parameters<typeof html2canvas>[1]);

  // Calculate PDF dimensions to fit the image
  const imgWidth = canvasImage.width;
  const imgHeight = canvasImage.height;
  const aspectRatio = imgWidth / imgHeight;

  // Use A4 landscape if wider, portrait if taller
  const isLandscape = aspectRatio > 1;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  let pdfWidth = pageWidth;
  let pdfHeight = pageWidth / aspectRatio;

  // If image is too tall, scale down to fit page height
  if (pdfHeight > pageHeight) {
    pdfHeight = pageHeight;
    pdfWidth = pageHeight * aspectRatio;
  }

  // Center the image on the page
  const xOffset = (pageWidth - pdfWidth) / 2;
  const yOffset = (pageHeight - pdfHeight) / 2;

  pdf.addImage(
    canvasImage.toDataURL('image/png'),
    'PNG',
    xOffset,
    yOffset,
    pdfWidth,
    pdfHeight
  );

  return pdf.output('blob');
}

/**
 * Export outline view as structured PDF
 */
async function exportOutlineToPDF(
  nodes: NodeMap,
  rootId: string,
  visibleNodeIds: Set<string>
): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const lineHeight = 7;
  const indentSize = 5;
  let yPosition = margin;

  // Helper to add new page if needed
  const checkPageBreak = () => {
    if (yPosition > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
  };

  // Helper to render a node and its visible children
  const renderNode = (nodeId: string, depth: number) => {
    if (!visibleNodeIds.has(nodeId)) {
      return;
    }

    const node = nodes[nodeId];
    if (!node) return;

    checkPageBreak();

    const xPosition = margin + (depth * indentSize);
    const maxTextWidth = pageWidth - xPosition - margin;

    // Set font based on depth (root is larger/bold)
    if (depth === 0) {
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
    } else {
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
    }

    // Render icons if present
    let iconText = '';
    if (node.icons && node.icons.length > 0) {
      const sortedIcons = sortIconsByDisplayOrder(node.icons);
      iconText = sortedIcons.map(icon => {
        const def = getIconDefinition(icon);
        // Use the label for text representation, or text if available
        return def ? (def.text || def.label.split(' - ')[0]) : '';
      }).filter(Boolean).join(' ') + ' ';
    }

    // Render text (with word wrapping)
    const nodeText = node.content.type === 'text' ? node.content.text : '[image]';
    const fullText = iconText + nodeText;
    const lines = pdf.splitTextToSize(fullText, maxTextWidth);
    
    for (let i = 0; i < lines.length; i++) {
      checkPageBreak();
      pdf.text(lines[i], xPosition, yPosition);
      yPosition += lineHeight;
    }

    // Add link indicator if node has a link
    if (node.link) {
      pdf.setFontSize(9);
      pdf.setTextColor(168, 85, 247); // Purple color
      pdf.text(`🔗 ${node.link}`, xPosition + 2, yPosition);
      pdf.setTextColor(0, 0, 0); // Reset to black
      yPosition += lineHeight * 0.8;
    }

    // Add small spacing after each node
    yPosition += 2;

    // Render visible children
    if (node.childIds && !node.isCollapsed) {
      for (const childId of node.childIds) {
        if (visibleNodeIds.has(childId)) {
          renderNode(childId, depth + 1);
        }
      }
    }
  };

  // Start rendering from root
  renderNode(rootId, 0);

  return pdf.output('blob');
}
