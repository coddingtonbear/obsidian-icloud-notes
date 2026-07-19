import { setIcon } from "obsidian";
import type IcloudPlugin from "./main";

/** Connection + outstanding-change indicator, fed by `icloud-md status --json`. Click opens
 * the same Pull now/Push now/Reauthenticate/Show status menu as the ribbon icon. */
export class IcloudStatusBar {
	private readonly el: HTMLElement;

	constructor(private readonly plugin: IcloudPlugin) {
		this.el = plugin.addStatusBarItem();
		this.el.addClass("mod-clickable");
		this.el.onClickEvent((evt) => this.plugin.buildActionMenu().showAtMouseEvent(evt));
		this.refresh();
	}

	refresh(): void {
		const { el } = this;
		el.empty();
		const iconEl = el.createSpan();
		const textEl = el.createSpan({ cls: "icloud-status-bar-text" });

		const state = this.plugin.syncState;
		switch (state.kind) {
			case "disconnected":
				setIcon(iconEl, "cloud-off");
				el.ariaLabel = "Apple notes sync: not connected";
				break;
			case "syncing":
				setIcon(iconEl, "refresh-cw");
				el.ariaLabel = `Apple notes sync: ${state.label}...`;
				break;
			case "error":
				setIcon(iconEl, "alert-triangle");
				el.ariaLabel = `Apple notes sync: ${state.message}`;
				break;
			case "idle":
				if (state.pendingCount) {
					setIcon(iconEl, "cloud");
					textEl.setText(String(state.pendingCount));
					el.ariaLabel = `Apple notes sync: ${state.pendingCount} change(s) pending`;
				} else {
					setIcon(iconEl, "cloud-check");
					el.ariaLabel = "Apple notes sync: up to date";
				}
				break;
		}
	}
}
