import * as fs from "node:fs";
import * as path from "node:path";

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