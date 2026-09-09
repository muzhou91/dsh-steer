/**
 * dsh-steer browser half.
 *
 * Registers a small "steer" button at the right end of the composer tool row
 * (the `conversation.input.right` seat). The button appears only while the
 * current session is running. Clicking it submits the typed draft with the
 * `"steer"` delivery mode, which interrupts the running turn and injects the
 * message into it — rather than queueing it for after the turn.
 *
 * Prerequisite: the input shell must expose `inputActions.submitSteer()`.
 * Run `npm run install:dsh` (scripts/patch-submit-steer.mjs) once to add it.
 */
window.__ModuleLoader__.load({
	id: "dsh-steer",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		const css = ".dsh-steer-btn{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.dsh-steer-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=\"dsh-steer\"]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-steer";
			tag.dataset.pluginCss = "dsh-steer";
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		/** The composer control: appears while the agent is running; steers on click. */
		function SteerButton(props) {
			const running = props.useSession((s) => s.running);
			if (!running) return null;
			return react.createElement("button", {
				type: "button",
				className: "dsh-steer-btn",
				title: "Inject into current turn",
				"aria-label": "Inject into current turn",
				onClick: () => {
					if (props.inputActions && typeof props.inputActions.submitSteer === "function") {
						props.inputActions.submitSteer();
					}
				}
			}, react.createElement("svg", { viewBox: "0 0 16 16", width: 16, height: 16, fill: "currentColor", "aria-hidden": true },
				react.createElement("path", { d: "M3 3.5L8.5 8 3 12.5v-9z" }),
				react.createElement("path", { d: "M9 3.5L14.5 8 9 12.5v-9z" })
			));
		}
		const inject = ["slots"];
		function apply(ctx) {
			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "steer",
				order: 0,
				label: "Inject into current turn"
			}, SteerButton));
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
