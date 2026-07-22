import mammoth from 'mammoth';

/**
 * Parses a file (DOCX) and extracts chapters.
 * @param {File} file - The file object from the input.
 * @returns {Promise<Array<{title: string, content: string}>>} - Array of chapters.
 */
export async function parseFile(file) {
    const fileType = file.name.split('.').pop().toLowerCase();

    if (fileType === 'docx' || fileType === 'doc') {
        return await parseDocx(file);
    } else {
        throw new Error("Unsupported format. Please upload Word (.docx) files");
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


