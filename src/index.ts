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

	const srcDir = args[0];
	const dstDir = args[1];
	if(!fs.existsSync(srcDir))
	{
		usage(commandName);
		return 1;
	}

	const files = findEntries(srcDir);
	const program = ts.createProgram(files, {});
	for(const file of files)
	{
		const sourceFile = program.getSourceFile(file);
		if(sourceFile === undefined)
		{
			continue;
		}

		const builtSource = build(sourceFile);
		const dstFile = path.join(dstDir, path.relative(srcDir, file));
		output(builtSource, dstFile);
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
		node = ts.visitEachChild(node, visitorFactory(sourceFileName, context), context);
		if(ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
		{
			return ts.visitEachChild(node, visitorResolverFactory(sourceFileName), context);
		}

		return node;
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

		const moduleName = node.text;
		const baseDir = path.dirname(sourceFileName);
		const resolvedModuleName = resolveModuleName(moduleName, baseDir);
		return ts.createStringLiteral(resolvedModuleName);
	};
}

/**
 * resolves module name
 * @param moduleName modle name
 * @param baseDir base directory
 * @returns resolved module name
 */
function resolveModuleName(moduleName: string, baseDir: string): string
{
	if(!shouldResolve(moduleName))
	{
		return moduleName;
	}

	const base = path.isAbsolute(moduleName) ? moduleName : path.join(baseDir, moduleName);
	for(const ext of ["", ".ts", ".js"])
	{
		const resolvedName = `${base}${ext}`;
		if(fs.existsSync(resolvedName))
		{
			// resolved
			return `${moduleName}${ext}`;
		}
	}

	// not resolved
	return moduleName;
}

/**
 * should resolve?
 * @param moduleName module name
 * @returns Yes/No
 */
function shouldResolve(moduleName: string): boolean
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
 * output built source
 * @param builtSource built source code
 * @param fileName file name to output
 */
function output(builtSource: string, fileName: string): void
{
	const dirName = path.dirname(fileName);
	if(!fs.existsSync(dirName))
	{
		fs.mkdirSync(dirName, {
			recursive: true,
		});
	}

	fs.writeFile(fileName, builtSource, (err) =>
	{
		if(err === null)
		{
			return;
		}
		console.error(`Output error: ${err.message}`);
	});
}

main(path.basename(process.argv[1]), process.argv.slice(2));
process
	.on("exit", (code) =>
	{
		process.exit(code);
	});
