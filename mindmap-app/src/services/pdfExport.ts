import jsPDF from 'jspdf';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import type { NodeMap } from '../types';
import { getIconDefinition, sortIconsByDisplayOrder, getIconSvg } from '../types';

// Cache for the loaded font
let notoSansJPFont: string | null = null;

/**
 * Load NotoSansJP font from Google Fonts and convert to base64
 */
async function loadNotoSansJPFont(): Promise<string> {
  if (notoSansJPFont) {
    return notoSansJPFont;
  }

  try {
    // Fetch NotoSansJP-Regular from Google Fonts CDN (Regular weight 400)
    const fontUrl = 'https://fonts.gstatic.com/s/notosansjp/v56/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf';
    const response = await fetch(fontUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch font: ${response.status}`);
    }

    const fontBlob = await response.blob();

    // Convert to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        notoSansJPFont = base64;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(fontBlob);
    });
  } catch (error) {
    console.error('Failed to load NotoSansJP font:', error);
    throw error;
  }
}

/**
 * Register NotoSansJP font with jsPDF instance
 */
async function registerNotoSansJP(pdf: jsPDF): Promise<void> {
  try {
    const fontBase64 = await loadNotoSansJPFont();
    pdf.addFileToVFS('NotoSansJP-Regular.ttf', fontBase64);
    pdf.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
    pdf.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'bold'); // Use same font for bold
  } catch (error) {
    console.warn('Could not load NotoSansJP font, Japanese text may not display correctly:', error);
  }
}

/**
 * Export the current view as a PDF
 * @param viewMode The current view mode ('mindmap' or 'outline')
 * @param nodes The current node map
 * @param rootId The root node ID
 * @param visibleNodeIds Set of visible node IDs (respects filters and collapse state)
 * @param currentFilePath Optional path to the currently open .mindmap file
 */
export async function exportToPDF(
  viewMode: 'mindmap' | 'outline',
  nodes: NodeMap,
  rootId: string,
  visibleNodeIds: Set<string>,
  currentFilePath?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate default PDF path based on current file
    let defaultPath = 'mindmap.pdf';
    if (currentFilePath) {
      // Replace .mindmap extension with .pdf
      defaultPath = currentFilePath.replace(/\.mindmap$/i, '.pdf');
    }

    // Show save dialog
    const filePath = await save({
      filters: [{
        name: 'PDF',
        extensions: ['pdf']
      }],
      defaultPath
    });

    if (!filePath) {
      return { success: false, error: 'Save cancelled' };
    }

    let pdfBlob: Blob;

    if (viewMode === 'mindmap') {
      pdfBlob = await exportMindmapToPDF(nodes, visibleNodeIds);
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
 * Export mindmap canvas as multi-page PDF with clickable links
 * Tiles the entire mind map across multiple A4 pages while preserving zoom level
 */
async function exportMindmapToPDF(nodes: NodeMap, visibleNodeIds: Set<string>): Promise<Blob> {
  const canvasContainer = document.querySelector('.pixi-canvas-container') as HTMLElement;

  if (!canvasContainer) {
    throw new Error('Canvas container not found');
  }

  // Find the canvas element and get access to PixiJS stage
  const canvas = canvasContainer.querySelector('canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas not found');
  }

  // Get node layouts and viewport state
  const nodeLayouts = (window as any).__mindmapNodeLayouts as Map<string, { x: number; y: number; width: number; height: number }>;
  const viewport = (window as any).__mindmapViewport as { x: number; y: number; scale: number; canvasWidth: number; canvasHeight: number };

  if (!nodeLayouts || !viewport) {
    throw new Error('Mind map layout data not available');
  }

  // Calculate bounding box of all visible nodes in world coordinates
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let nodeCount = 0;
  for (const [nodeId, layout] of nodeLayouts.entries()) {
    if (!visibleNodeIds.has(nodeId)) continue;
    nodeCount++;
    minX = Math.min(minX, layout.x);
    minY = Math.min(minY, layout.y);
    maxX = Math.max(maxX, layout.x + layout.width);
    maxY = Math.max(maxY, layout.y + layout.height);
  }

  // Add minimal padding
  const padding = 20;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  // Prompt user for desired number of pages wide using custom dialog
  const defaultCols = 1;
  const desiredCols = await new Promise<number>((resolve, reject) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';

    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = 'background: white; padding: 24px; border-radius: 8px; max-width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';
    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #1f2937;">PDF Export Settings</h3>
      <p style="margin: 0 0 16px 0; color: #6b7280; line-height: 1.5;">
        Your mind map is <strong>${contentWidth.toFixed(0)} × ${contentHeight.toFixed(0)}</strong> world units.
      </p>
      <label style="display: block; margin-bottom: 16px;">
        <span style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">Number of pages wide:</span>
        <input type="number" id="pdfColsInput" value="${defaultCols}" min="1" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px;">
        <span style="display: block; margin-top: 4px; font-size: 12px; color: #6b7280;">Height will automatically adjust to fit all content</span>
      </label>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="pdfCancelBtn" style="padding: 8px 16px; border: 1px solid #d1d5db; background: white; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
        <button id="pdfOkBtn" style="padding: 8px 16px; border: none; background: #3b82f6; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">Export</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const input = dialog.querySelector('#pdfColsInput') as HTMLInputElement;
    const okBtn = dialog.querySelector('#pdfOkBtn') as HTMLButtonElement;
    const cancelBtn = dialog.querySelector('#pdfCancelBtn') as HTMLButtonElement;

    input.focus();
    input.select();

    const cleanup = () => document.body.removeChild(overlay);

    okBtn.onclick = () => {
      const value = parseInt(input.value, 10);
      cleanup();
      if (isNaN(value) || value < 1) {
        reject(new Error('Invalid number of pages. Please enter a positive number.'));
      } else {
        resolve(value);
      }
    };

    cancelBtn.onclick = () => {
      cleanup();
      reject(new Error('PDF export cancelled'));
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        okBtn.click();
      } else if (e.key === 'Escape') {
        cancelBtn.click();
      }
    };
  });

  // Create PDF in landscape mode (better for mind maps)
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Calculate zoom level to fit content width into desired number of pages
  // Each page in world space should be pageWidth / scale
  // We want: contentWidth = desiredCols * (pageWidth / scale)
  // Therefore: scale = (desiredCols * pageWidth) / contentWidth
  const baseScale = (desiredCols * pageWidth) / contentWidth;

  // Use the PDF page dimensions to determine tile dimensions
  // This ensures consistent results regardless of window size
  const worldPageWidth = pageWidth / baseScale;
  const worldPageHeight = pageHeight / baseScale;

  // For high-res output (3x = ~300 DPI), we render at a fixed high scale
  // If the canvas is too small to fit the entire page at this scale,
  // we'll render in multiple chunks and stitch them together
  const targetResolutionMultiplier = 3;
  const calculatedScale = baseScale * targetResolutionMultiplier;

  // Calculate how many pages we need in each direction
  const cols = desiredCols;
  const rows = Math.ceil(contentHeight / worldPageHeight);

  // Get reference to the PixiJS Application through window
  const pixiApp = (window as any).__pixiApp;
  if (!pixiApp) {
    throw new Error('PixiJS Application not available');
  }

  // Store original viewport position
  const originalX = pixiApp.stage.x;
  const originalY = pixiApp.stage.y;
  const originalScale = pixiApp.stage.scale.x;

  // High-res output dimensions (fixed at 3x for consistent quality)
  const hiResWidth = Math.ceil(pageWidth * targetResolutionMultiplier);
  const hiResHeight = Math.ceil(pageHeight * targetResolutionMultiplier);

  // Calculate how many chunks we need to render each page
  // Each chunk must fit within the screen canvas
  const chunkWorldWidth = canvas.width / calculatedScale;
  const chunkWorldHeight = canvas.height / calculatedScale;
  const chunksPerPageX = Math.ceil(worldPageWidth / chunkWorldWidth);
  const chunksPerPageY = Math.ceil(worldPageHeight / chunkWorldHeight);

  try {
    // Generate each page
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Calculate world coordinates for this page
        const pageWorldX = minX + col * worldPageWidth;
        const pageWorldY = minY + row * worldPageHeight;

        // Create high-res canvas for this page
        const hiResCanvas = document.createElement('canvas');
        hiResCanvas.width = hiResWidth;
        hiResCanvas.height = hiResHeight;
        const hiResCtx = hiResCanvas.getContext('2d')!;

        // Render this page in chunks to handle large content
        for (let chunkY = 0; chunkY < chunksPerPageY; chunkY++) {
          for (let chunkX = 0; chunkX < chunksPerPageX; chunkX++) {
            // Calculate world coordinates for this chunk
            const chunkWorldX = pageWorldX + chunkX * chunkWorldWidth;
            const chunkWorldY = pageWorldY + chunkY * chunkWorldHeight;

            // Set viewport to capture this chunk
            pixiApp.stage.x = -chunkWorldX * calculatedScale;
            pixiApp.stage.y = -chunkWorldY * calculatedScale;
            pixiApp.stage.scale.set(calculatedScale);

            // Force PixiJS to render
            pixiApp.renderer.render(pixiApp.stage);

            // Small delay to ensure rendering completes
            await new Promise(resolve => setTimeout(resolve, 20));

            // Calculate where this chunk goes in the high-res canvas
            const destX = chunkX * chunkWorldWidth * calculatedScale;
            const destY = chunkY * chunkWorldHeight * calculatedScale;

            // Calculate source dimensions (may be clipped at edges)
            const srcWidth = Math.min(canvas.width, (worldPageWidth - chunkX * chunkWorldWidth) * calculatedScale);
            const srcHeight = Math.min(canvas.height, (worldPageHeight - chunkY * chunkWorldHeight) * calculatedScale);

            // Draw this chunk to the high-res canvas
            hiResCtx.drawImage(
              canvas,
              0, 0, srcWidth, srcHeight, // Source rectangle
              destX, destY, srcWidth, srcHeight // Destination rectangle (same size, positioned correctly)
            );
          }
        }

        // Convert high-res canvas to data URL
        const hiResDataURL = hiResCanvas.toDataURL('image/png');

        // Add new page if not first
        if (row > 0 || col > 0) {
          pdf.addPage();
        }

        // Add the high-res image to PDF, filling the entire page
        pdf.addImage(hiResDataURL, 'PNG', 0, 0, pageWidth, pageHeight);

        // Add clickable link annotations for this page
        const tileMinX = pageWorldX;
        const tileMinY = pageWorldY;
        const tileMaxX = pageWorldX + worldPageWidth;
        const tileMaxY = pageWorldY + worldPageHeight;

        for (const [nodeId, layout] of nodeLayouts.entries()) {
          if (!visibleNodeIds.has(nodeId)) continue;

          const node = nodes[nodeId];
          if (!node?.link) continue;

          // Check if node is within this tile
          const nodeRight = layout.x + layout.width;
          const nodeBottom = layout.y + layout.height;

          if (layout.x >= tileMinX && nodeRight <= tileMaxX &&
              layout.y >= tileMinY && nodeBottom <= tileMaxY) {

            // Convert to PDF coordinates
            // Node position relative to tile start in world units
            const nodeRelX = (layout.x - tileMinX) * calculatedScale;
            const nodeRelY = (layout.y - tileMinY) * calculatedScale;
            const nodeW = layout.width * calculatedScale;
            const nodeH = layout.height * calculatedScale;

            // Map to PDF page (high-res canvas is scaled down to page size)
            const pdfX = (nodeRelX / hiResWidth) * pageWidth;
            const pdfY = (nodeRelY / hiResHeight) * pageHeight;
            const pdfW = (nodeW / hiResWidth) * pageWidth;
            const pdfH = (nodeH / hiResHeight) * pageHeight;

            // Add clickable link annotation
            pdf.link(pdfX, pdfY, pdfW, pdfH, { url: node.link });
          }
        }
      }
    }
  } finally {
    // Restore original viewport
    pixiApp.stage.x = originalX;
    pixiApp.stage.y = originalY;
    pixiApp.stage.scale.set(originalScale);
    pixiApp.renderer.render(pixiApp.stage);
  }

  return pdf.output('blob');
}

/**
 * Convert SVG string to PNG data URL using canvas rendering
 */
async function svgToPngDataUrl(svgString: string, color: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // Process the SVG string
    let processedSvg = svgString;

    // Remove comments
    processedSvg = processedSvg.replace(/<!--.*?-->/g, '');

    // Add xmlns if not present
    if (!processedSvg.includes('xmlns=')) {
      processedSvg = processedSvg.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    // Remove attributes that might interfere
    processedSvg = processedSvg.replace(/fill="none"/g, '');
    processedSvg = processedSvg.replace(/class="[^"]*"/g, '');
    processedSvg = processedSvg.replace(/stroke="currentColor"/g, '');

    // Remove any existing fill and stroke attributes on svg tag
    processedSvg = processedSvg.replace(/<svg([^>]*?)fill="[^"]*"/g, '<svg$1');
    processedSvg = processedSvg.replace(/<svg([^>]*?)stroke="[^"]*"/g, '<svg$1');
    processedSvg = processedSvg.replace(/<svg([^>]*?)stroke-width="[^"]*"/g, '<svg$1');

    // Add color to svg tag - both fill and stroke
    processedSvg = processedSvg.replace(/<svg/, `<svg fill="${color}" stroke="${color}"`);

    // Use data URL directly instead of blob URL for better compatibility
    const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(processedSvg);

    // Create an image element
    const img = new Image();

    // Set a timeout to reject if loading takes too long
    const timeout = setTimeout(() => {
      reject(new Error('SVG load timeout'));
    }, 5000);

    img.onload = () => {
      clearTimeout(timeout);

      try {
        // Create a canvas to render the SVG
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;

        // Draw white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);

        // Draw the image onto the canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to PNG data URL
        const pngDataUrl = canvas.toDataURL('image/png');

        resolve(pngDataUrl);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    };

    img.onerror = (error) => {
      clearTimeout(timeout);
      console.error('SVG load error:', error, 'Processed SVG:', processedSvg.substring(0, 300));
      reject(new Error('Failed to load SVG'));
    };

    img.src = svgDataUrl;
  });
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

  // Register NotoSansJP font for Japanese text support
  await registerNotoSansJP(pdf);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const lineHeight = 7;
  const indentSize = 5;
  const iconSize = 4; // Icon size in mm
  const iconSpacing = 1; // Space between icons in mm
  let yPosition = margin;

  // Convert mm to pixels for icon rendering (assuming 96 DPI)
  const iconSizePx = Math.round(iconSize * 96 / 25.4);

  // Helper to add new page if needed
  const checkPageBreak = () => {
    if (yPosition > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
  };

  // Helper to render a node and its visible children
  const renderNode = async (nodeId: string, depth: number): Promise<void> => {
    if (!visibleNodeIds.has(nodeId)) {
      return;
    }

    const node = nodes[nodeId];
    if (!node) return;

    checkPageBreak();

    const xPosition = margin + (depth * indentSize);

    // Set font based on depth (root is larger/bold)
    if (depth === 0) {
      pdf.setFontSize(16);
      pdf.setFont('NotoSansJP', 'bold');
    } else {
      pdf.setFontSize(11);
      pdf.setFont('NotoSansJP', 'normal');
    }

    let currentX = xPosition;

    // Render collapse/expand indicator or bullet
    const hasChildren = node.childIds && node.childIds.length > 0;
    const indicator = hasChildren ? (node.isCollapsed ? '▶' : '▼') : '•';

    pdf.setTextColor(128, 128, 128); // Gray color for indicator
    pdf.setFontSize(8);
    pdf.text(indicator, currentX, yPosition);
    currentX += 4; // Space after indicator

    // Reset text color and font size
    pdf.setTextColor(0, 0, 0);
    if (depth === 0) {
      pdf.setFontSize(16);
    } else {
      pdf.setFontSize(11);
    }

    // Render icons if present

    if (node.icons && node.icons.length > 0) {
      const sortedIcons = sortIconsByDisplayOrder(node.icons);

      for (const icon of sortedIcons) {
        const def = getIconDefinition(icon);
        if (def) {
          checkPageBreak();

          // Get SVG string for the icon
          const svgString = getIconSvg(icon.type, icon.value);
          if (svgString) {
            try {
              const color = def.color || '#000000';
              // Convert SVG to PNG
              const pngDataUrl = await svgToPngDataUrl(svgString, color, iconSizePx, iconSizePx);

              // Add icon image to PDF
              pdf.addImage(pngDataUrl, 'PNG', currentX, yPosition - iconSize + 1, iconSize, iconSize);
            } catch (error) {
              console.error('Failed to render icon:', error);
              // Fallback: render as text if SVG conversion fails
              if (def.text) {
                pdf.setFontSize(8);
                pdf.text(def.text, currentX, yPosition);
                pdf.setFontSize(depth === 0 ? 16 : 11);
              }
            }
          }

          currentX += iconSize + iconSpacing;
        }
      }

      // Add space after icons
      currentX += 2;
    }

    // Render text (with word wrapping)
    // Note: jsPDF's default fonts (Helvetica, Times, Courier) only support Latin characters
    // Japanese and other non-Latin text will appear as empty/missing in the PDF
    // To properly support Japanese text, you would need to:
    // 1. Add a font that supports Japanese (like NotoSansJP) using pdf.addFileToVFS() and pdf.addFont()
    // 2. Set that font before rendering text
    // For now, non-Latin characters may not display correctly
    const nodeText = node.content.type === 'text' ? node.content.text : '[image]';
    const availableTextWidth = pageWidth - currentX - margin;
    const lines = pdf.splitTextToSize(nodeText, availableTextWidth);
    
    for (let i = 0; i < lines.length; i++) {
      checkPageBreak();
      pdf.text(lines[i], currentX, yPosition);
      yPosition += lineHeight;
      // After first line, reset X position to node indent (not after icons)
      if (i === 0) {
        currentX = xPosition;
      }
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
          await renderNode(childId, depth + 1);
        }
      }
    }
  };

  // Start rendering from root
  await renderNode(rootId, 0);

  return pdf.output('blob');
}
