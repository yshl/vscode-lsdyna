import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.jumpToInclude', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const lines = document.getText().split('\n');
        const currentLineIndex = editor.selection.active.line;

        try {
            // get Full Path
            const paths = getSearchPath(document);
            const fileName = getFilenameFromKeyword(lines, currentLineIndex);
            const fullPath = searchFileFromPaths(fileName, paths);

            // Jump to File
            vscode.workspace.openTextDocument(fullPath).then(doc => {
                vscode.window.showTextDocument(doc);
            });
        } catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`${error.message}`);
            } else {
                throw error;
            }
        }
    });

    context.subscriptions.push(disposable);
}

/**
 * Gets the search paths for include files
 * First path is always the directory of the current file
 * Additional paths are extracted from *INCLUDE_PATH and *INCLUDE_PATH_RELATIVE keywords
 * @param document Current text document
 * @returns Array of search paths
 */
function getSearchPath(document: vscode.TextDocument) {
    const textPath = path.dirname(document.uri.fsPath);
    let paths = [textPath];

    const lines = document.getText().split('\n');
    let keyword = "";
    for(let i=0; i<lines.length; i++){
        if (lines[i].startsWith("$")){
            continue;
        }
        if (lines[i].startsWith("*")){
            keyword = lines[i].trim();
            continue;
        }
        if (keyword=="*INCLUDE_PATH"){
            paths.push(lines[i].trim());

        }else if (keyword=="*INCLUDE_PATH_RELATIVE"){
            paths.push(path.resolve(textPath, lines[i].trim()));
        }
    }
    return paths;
}

/**
 * Extracts the filename from the current keyword based on keyword type
 * Supports different types of INCLUDE keywords with varying file location cards
 * @param lines Array of document lines
 * @param lineindex Current line index
 * @returns Filename string
 */
function getFilenameFromKeyword(lines: string[], lineindex: number) {
    const linestart = startLineOfCurrentKeyword(lines, lineindex);
    const keyword = lines[linestart].trim();

    if (keyword == "*INCLUDE") {
        return getFilenameFromCurrentCard(lines, lineindex);

    } else if (keyword.startsWith("*INCLUDE_PATH")) {
        throw new Error("This keyword does not have filename card.");

    } else if (keyword.startsWith("*INCLUDE_MULTISCALE_SPOTWELD")) {
        return getFileNameFromNthCard(lines, linestart, 2);

    } else if (keyword.startsWith("*INCLUDE")) {
        return getFileNameFromNthCard(lines, linestart, 1);

    } else {
        throw new Error("This keyword is not supported.");
    }
}

/**
 * Finds the starting line of the current keyword by searching upwards
 * @param lines Array of document lines
 * @param lineindex Current line index
 * @returns Line index where the current keyword starts
 */
function startLineOfCurrentKeyword(lines: string[], lineindex: number) {
    for(let i=lineindex; i>=0; i--){
        if (lines[i].startsWith("*")){
            return i;
        }
    }
    throw new Error('not on any keyword.');
}

/**
 * Gets filename from the card where the cursor is currently positioned
 * Skips comment lines starting with '$'
 * @param lines Array of document lines
 * @param lineindex Current line index
 * @returns Filename string from the current card
 */
function getFilenameFromCurrentCard(lines: string[], lineindex: number) {
    if (lines[lineindex].startsWith("*")) {
        // Cursor on keyword line
        lineindex++;
    }
    while(!lines[lineindex].startsWith("*")){
        if (lines[lineindex].startsWith("$")){
            lineindex++;
            continue;
        }
        return lines[lineindex].trim();
    }
    throw new Error('No file to jump to.');
}

/**
 * Gets filename from the nth card of the current keyword
 * Skips comment lines starting with '$'
 * @param lines Array of document lines
 * @param lineindex Start line index of the keyword
 * @param nth Card number to read filename from
 * @returns Filename string from the specified card
 */
function getFileNameFromNthCard(lines: string[], lineindex: number, nth: number) {
    let card = 1;
    for(let i=lineindex+1; !lines[i].startsWith("*"); i++){
        if (lines[i].startsWith("$")){
            continue;
        }
        if (card==nth) {
            return lines[i].trim();
        }
        card++;
    }
    throw new Error('No file to jump to.');
}

/**
 * Searches for a file in the given paths
 * Returns the first matching full path found
 * @param filePath Filename to search for
 * @param paths Array of directories to search in
 * @returns Full path of the found file
 */
function searchFileFromPaths(filePath: string, paths: string[]) {
    for (let i = 0; i < paths.length; i++) {
        const fullPath = path.resolve(paths[i], filePath);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }
    throw new Error(`${filePath} not found`);
}

export function deactivate() {}
