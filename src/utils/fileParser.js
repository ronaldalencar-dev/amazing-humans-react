import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Parses a file (DOCX or PDF) and extracts chapters.
 * @param {File} file - The file object from the input.
 * @returns {Promise<Array<{title: string, content: string}>>} - Array of chapters.
 */
export async function parseFile(file) {
    const fileType = file.name.split('.').pop().toLowerCase();

    if (fileType === 'docx' || fileType === 'doc') {
        return await parseDocx(file);
    } else if (fileType === 'pdf') {
        return await parsePdf(file);
    } else {
        throw new Error("Unsupported format. Please upload Word (.docx) or PDF files");
    }
}

/**
 * Parses a DOCX file using Mammoth.
 */
async function parseDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    // Use convertToHtml to preserve the original paragraphs and formatting
    const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
    const html = result.value;
    return extractChaptersFromHtml(html);
}

/**
 * Parses a PDF file using pdfjs-dist.
 */
async function parsePdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        let lastY = -1;
        let pageText = "";
        
        for (const item of textContent.items) {
            if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 12) {
                // Large vertical jump usually means a new paragraph or line break
                pageText += "\n";
            }
            pageText += item.str;
            lastY = item.transform[5];
        }
        fullText += pageText + "\n\n";
    }

    return extractChaptersFromText(fullText);
}

const chapterStartRegex = /^\s*(?:chapter|cap[íi]tulo|part|parte)\s+(?:\d+|[ivxlcm]+)/i;

/**
 * Splits HTML string from Mammoth into chapters, preserving formatting.
 */
function extractChaptersFromHtml(html) {
    const chapters = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    let currentChapter = { title: "Introduction", content: "" };
    let foundFirstChapter = false;

    Array.from(doc.body.children).forEach(element => {
        const text = element.textContent || "";
        
        // If it's a short text block matching chapter syntax
        if (chapterStartRegex.test(text) && text.trim().length < 150) {
            if (foundFirstChapter || currentChapter.content.trim().length > 0) {
                chapters.push({
                    ...currentChapter
                });
            }
            currentChapter = {
                title: text.trim(),
                content: ""
            };
            foundFirstChapter = true;
        } else {
            // Preserve the original HTML structure
            currentChapter.content += element.outerHTML;
        }
    });

    if (currentChapter.content.trim().length > 0) {
        chapters.push({
            ...currentChapter
        });
    }

    if (chapters.length === 0 && currentChapter.content.length > 0) {
        chapters.push({ title: "Full Content", content: currentChapter.content });
    }

    return chapters;
}

/**
 * Splits plain text from PDF into chapters and formats content as HTML paragraphs.
 */
function extractChaptersFromText(fullText) {
    const chapters = [];
    const text = fullText.replace(/\r\n/g, '\n');
    const lines = text.split('\n');

    let currentChapter = { title: "Introduction", content: "" };
    let foundFirstChapter = false;

    for (const line of lines) {
        if (chapterStartRegex.test(line) && line.trim().length < 150) {
            if (foundFirstChapter || currentChapter.content.trim().length > 0) {
                chapters.push({
                    ...currentChapter,
                    content: formatContentToHtml(currentChapter.content)
                });
            }
            currentChapter = {
                title: line.trim(),
                content: ""
            };
            foundFirstChapter = true;
        } else {
            currentChapter.content += line + "\n";
        }
    }

    if (currentChapter.content.trim().length > 0) {
        chapters.push({
            ...currentChapter,
            content: formatContentToHtml(currentChapter.content)
        });
    }

    if (chapters.length === 0 && currentChapter.content.length > 0) {
        chapters.push({ title: "Full Content", content: formatContentToHtml(currentChapter.content) });
    }

    return chapters;
}

/**
 * Formats plain text content into HTML paragraphs (used for PDF).
 */
function formatContentToHtml(content) {
    if (!content) return "";
    
    let paragraphs = content.split(/\n\s*\n/);
    if (paragraphs.length <= 1) {
        paragraphs = content.split(/\n/);
    }

    return paragraphs
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => `<p>${p.replace(/\n/g, ' ')}</p>`)
        .join('');
}
