import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const vbsPath = path.join(process.cwd(), 'scripts', 'test-sap-gui.vbs');
    if (!fs.existsSync(vbsPath)) {
      return NextResponse.json({ error: 'Test script not found' }, { status: 500 });
    }

    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const cscript32 = path.join(systemRoot, 'SysWOW64', 'cscript.exe');
    const cscriptExe = fs.existsSync(cscript32) ? cscript32 : 'cscript';

    const cmd = `"${cscriptExe}" //Nologo "${vbsPath}"`;

    let stdout = '';
    let stderr = '';
    try {
      const result = await execAsync(cmd, {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (execError: any) {
      if (execError.stdout) stdout = execError.stdout as string;
      if (execError.stderr) stderr = execError.stderr as string;
    }

    const lines = stdout.split('\n').filter((l: string) => l.trim());
    const errLines = stderr.split('\n').filter((l: string) => l.trim());

    return NextResponse.json({
      success: true,
      output: lines,
      stderr: errLines,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
