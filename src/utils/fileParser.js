import mammoth from 'mammoth';

/**
 * Parses a file (DOCX only) and extracts chapters.
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
    // Use extractRawText but preserve double newlines
    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    const text = result.value;
    return extractChapters(text);
}

/**
 * Splits text into chapters and formats content as HTML paragraphs.
 */
function extractChapters(fullText) {
    const chapters = [];

    // Normalize line endings
    const text = fullText.replace(/\r\n/g, '\n');
    const lines = text.split('\n');

    let currentChapter = { title: "Introduction", content: "" };
    let foundFirstChapter = false;

    // Pattern: Start of line, optional whitespace, "Chapter" or "Capítulo", space, number
    const chapterStartRegex = /^\s*(?:chapter|cap[íi]tulo|part|parte)\s+(?:\d+|[ivxlcm]+)/i;

    for (const line of lines) {
        if (chapterStartRegex.test(line)) {
            // Push previous chapter if it exists
            if (foundFirstChapter || currentChapter.content.trim().length > 0) {
                if (currentChapter.content.trim().length > 0 || foundFirstChapter) {
                    chapters.push({
                        ...currentChapter,
                        content: formatContentToHtml(currentChapter.content)
                    });
                }
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

    // Push the last chapter
    if (currentChapter.content.trim().length > 0) {
        chapters.push({
            ...currentChapter,
            content: formatContentToHtml(currentChapter.content)
        });
    }

    // If no chapters were detected (only Introduction), return it as one chapter
    if (chapters.length === 0 && currentChapter.content.length > 0) {
        chapters.push({ title: "Full Content", content: formatContentToHtml(currentChapter.content) });
    }

    return chapters;
}

/**
 * Formats plain text content into HTML paragraphs.
 */
function formatContentToHtml(content) {
    if (!content) return "";

    // Split by double newlines to find paragraphs
    const paragraphs = content.split(/\n\s*\n/);

    return paragraphs
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
}
