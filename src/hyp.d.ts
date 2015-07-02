declare module "hyp" {
	interface Ast {
	    //kind: AstKind;
	    //type?: AstType;
	}

	interface AstLambda extends Ast {
	    //cases: Case[];
	    //scanState: ScanState;
	}

	interface AstModule extends AstLambda {
	    name: string;
	}

	function AstParser(source: string): { ruleModule(): AstModule };
}