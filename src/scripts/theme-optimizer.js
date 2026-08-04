/**
 * Compatibility shim for integrations that expect window.themeOptimizer.
 * Theme switching is now handled by the bounded Katelya transition controller,
 * so this surface intentionally performs no layout work or style rewrites.
 */

const themeOptimizer = {
	observeCodeBlocks() {},
	applyCodeBlockTransitionBehavior() {},
	destroy() {},
};

window.themeOptimizer = themeOptimizer;
document.dispatchEvent(new CustomEvent("themeOptimizerReady"));
