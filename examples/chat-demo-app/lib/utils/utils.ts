import * as fs from "node:fs";
import * as path from "node:path";
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';

export abstract class Utils {
  static copyDirRecursive(sourceDir: string, targetDir: string): void {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir);
    }

    const files = fs.readdirSync(sourceDir);

    for (const file of files) {
      const sourceFilePath = path.join(sourceDir, file);
      const targetFilePath = path.join(targetDir, file);
      const stats = fs.statSync(sourceFilePath);

      if (stats.isDirectory()) {
        Utils.copyDirRecursive(sourceFilePath, targetFilePath);
      } else {
        fs.copyFileSync(sourceFilePath, targetFilePath);
      }
    }
  }
}

/**
 * Interface to store the combination of filenames and their contents.
 * @key: filename
 * @value: contents of the file
 *
 * Usage:
 * const fileBuffers: FileBufferMap = {
 * 'file1.txt': Buffer.from('This is file 1'),
 * 'file2.jpg': Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // Binary data for a JPG file
 * 'file3.pdf': Buffer.from('...'), // Binary data for a PDF file
};
 */
export interface FileBufferMap {
  [filename: string]: Buffer;
}

export function generateFileBufferMap(files: Buffer[]) {
  let tempBufferMap: FileBufferMap = {};
  files.forEach(file => tempBufferMap[uuidv4()] = file);

  return tempBufferMap;
}

/**
* Writes a set of files to a specified directory. This is used for creating a
* temp directory for the contents of the assets that need to be uploaded to S3
*
* @param dirPath - The path of the directory where the files will be written.
* @param files - A map of file names to file buffers, representing the files to be written.
*/
export function writeFilesToDir(dirPath: string, files: FileBufferMap) {
  for (const [fileName, fileBuffer] of Object.entries(files)) {
      const filePath = resolve(dirPath, fileName);
      writeFileSync(filePath, fileBuffer);
  }
}

/**
* Collection and property names follow regex: ^[a-z][a-z0-9-]{2,31}$. We will
* use the first 32-suffixLength characters of the Kb to generate the name.
*
* @param resourceName Name of the kb/collection. This will be trimmed to fit suffix.
* @param suffix Suffix to append to the kbName.
* @returns string that conforms to AOSS validations (timmedName-prefix)
*/
export function generateNamesForAOSS(resourceName: string, suffix: string) {
  const MAX_ALLOWED_NAME_LENGTH = 32;
  const maxResourceNameLength = MAX_ALLOWED_NAME_LENGTH - suffix.length - 1; // Subtracts an additional 1 to account for the hyphen between resourceName and suffix.
  return `${resourceName.slice(0, maxResourceNameLength)}-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, '');  // Replaces any characters that do not match [a-z0-9-] with an empty string.
}