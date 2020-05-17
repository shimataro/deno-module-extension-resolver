import fs from "fs";
import path from "path";

import glob from "fast-glob";
import ts from "typescript";

/**
 * main function
 * @param commandName command name
 * @param args arguments
 * @returns exit status
 */
function main(commandName: string, args: string[]): number
{
	if(args.length !== 2)
	{
		usage(commandName);
		return 1;
	}

	const [srcDirName, dstDirName] = args;
	if(!isDirectory(srcDirName))
	{
		usage(commandName);
		return 1;
	}

	const srcFileNames = findEntries(srcDirName);
	const program = ts.createProgram(srcFileNames, {});
	for(const srcFileName of srcFileNames)
	{
		const sourceFile = program.getSourceFile(srcFileName);
		if(sourceFile === undefined)
		{
			continue;
		}

		const builtCode = build(sourceFile);
		const dstFileName = path.join(dstDirName, path.relative(srcDirName, srcFileName));
		output(builtCode, dstFileName);
	}
	return 0;
}

/**
 * show usage
 * @param commandName command name
 */
function usage(commandName: string): void
{
	console.log(`usage: ${commandName} SRC_DIR DST_DIR`);
}

/**
 * find entries
 * @param dirName directory to search
 * @returns stream of entries
 */
export function findEntries(dirName: string): string[]
{
	const source = `${dirName}/**/*.{ts,js}`;
	return glob.sync(source);
}

/**
 * build source file
 * @param sourceFile source file object
 * @returns built source file
 */
function build(sourceFile: ts.SourceFile): string
{
	const result = ts.transform(sourceFile, [transformerFactory]);
	result.dispose();

	const printer = ts.createPrinter();
	return printer.printFile(result.transformed[0]);
}

/**
 * transformer factory
 * @param context transformation context
 * @returns transformer
 */
function transformerFactory(context: ts.TransformationContext): ts.Transformer<ts.SourceFile>
{
	return (rootNode: ts.SourceFile): ts.SourceFile =>
	{
		const sourceFileName = rootNode.getSourceFile().fileName;
		return ts.visitNode(rootNode, visitorFactory(sourceFileName, context));
	};
}

/**
 * visitor factory
 * @param sourceFileName source file name
 * @param context transformation context
 * @returns visitor
 */
function visitorFactory(sourceFileName: string, context: ts.TransformationContext): ts.Visitor
{
	return (node: ts.Node): ts.VisitResult<ts.Node> =>
	{
		if(ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
		{
			// "import" / "export from" statement
			return ts.visitEachChild(node, visitorResolverFactory(sourceFileName), context);
		}
		else
		{
			return ts.visitEachChild(node, visitorFactory(sourceFileName, context), context);
		}
	};
}

/**
 * resolver factory
 * @param sourceFileName source file name
 * @returns visitor
 */
function visitorResolverFactory(sourceFileName: string): ts.Visitor
{
	return (node: ts.Node): ts.VisitResult<ts.Node> =>
	{
		if(!ts.isStringLiteral(node))
		{
			return node;
		}

		// resolve if node is StringLiteral in ImportDeclaration/ExportDeclaration
		const moduleName = node.text;
		const baseDir = path.dirname(sourceFileName);
		const resolvedModuleName = resolveModuleExtension(moduleName, baseDir);
		return ts.createStringLiteral(resolvedModuleName);
	};
}

/**
 * resolves module name
 * @param moduleName modle name
 * @param baseDirName base directory
 * @returns resolved module name
 */
function resolveModuleExtension(moduleName: string, baseDirName: string): string
{
	if(!shouldResolveModuleExtension(moduleName))
	{
		return moduleName;
	}

	const resolvedPath = resolveModulePath(moduleName, baseDirName);
	for(const ext of ["", ".ts", ".js", "/index.ts", "/index.js"])
	{
		const resolvedName = `${resolvedPath}${ext}`;
		if(isFile(resolvedName))
		{
			// resolved
			return `${moduleName}${ext}`;
		}
	}

	// not resolved
	console.warn(`[WARN] Module not resolved: ${moduleName}`);
	return moduleName;
}

/**
 * should resolve?
 * @param moduleName module name
 * @returns Yes/No
 */
function shouldResolveModuleExtension(moduleName: string): boolean
{
	if(path.isAbsolute(moduleName))
	{
		// absolute path
		return true;
	}
	if(moduleName.startsWith("."))
	{
		// relative path
		return true;
	}

	return false;
}

/**
 * resolve module path
 * @param moduleName module name to resolve
 * @param baseDir base directory
 * @returns resolved path
 */
function resolveModulePath(moduleName: string, baseDir: string): string
{
	if(path.isAbsolute(moduleName))
	{
		return moduleName;
	}
	else
	{
		return path.resolve(baseDir, moduleName);
	}
}

/**
 * output built source
 * @param builtSource built source code
 * @param fileName file name to output
 */
function output(builtSource: string, fileName: string): void
{
	createDirectoriesIfNotExist(fileName);

	fs.writeFile(fileName, builtSource, (err) =>
	{
		if(err === null)
		{
			return;
		}
		console.error(`[ERROR] Output error: ${err.message}`);
	});
}

/**
 * create directories recursively if not exist
 * @param fileName file name
 */
function createDirectoriesIfNotExist(fileName: string): void
{
	const dirName = path.dirname(fileName);
	if(isDirectory(dirName))
	{
		// already exists
		return;
	}

	fs.mkdirSync(dirName, {
		recursive: true,
	});
}

/**
 * is dirName directory?
 * @param dirName dirname to check
 * @returns Yes/No
 */
function isDirectory(dirName: string): boolean
{
	try
	{
		const stats = fs.statSync(dirName);
		return stats.isDirectory();
	}
	catch(err)
	{
		return false;
	}
}

/**
 * is fileName file?
 * @param fileName filename to check
 * @returns Yes/No
 */
function isFile(fileName: string): boolean
{
	try
	{
		const stats = fs.statSync(fileName);
		return stats.isFile();
	}
	catch(err)
	{
		return false;
	}
}

main(path.basename(process.argv[1]), process.argv.slice(2));
