/**
 * Compatibility shim for older integrations that expect window.themeOptimizer.
 *
 * Theme switching is now handled by the bounded Katelya transition controller.
 * Keeping this tiny surface avoids layout reads, MutationObservers, forced GPU
 * layers, and per-component style rewrites during a colour-scheme change.
 */

const themeOptimizer = {
	observeCodeBlocks() {},
	applyCodeBlockTransitionBehavior() {},
	destroy() {},
};

window.themeOptimizer = themeOptimizer;
document.dispatchEvent(new CustomEvent("themeOptimizerReady"));
