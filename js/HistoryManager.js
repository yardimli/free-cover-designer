class HistoryManager {
	constructor(layerManager, options = {}) {
		this.layerManager = layerManager; // Reference to manage layer state
		this.history = [];
		this.historyIndex = -1;
		this.maxHistory = options.maxHistory || 50;
		this.onUpdate = options.onUpdate || (() => {}); // Callback for UI updates (e.g., button states)
	}
	
	saveState() {
		// Clear redo history if we make a new change after undoing
		if (this.historyIndex < this.history.length - 1) {
			this.history = this.history.slice(0, this.historyIndex + 1);
		}
		
		// Get current state from LayerManager (needs deep clone)
		const currentState = JSON.parse(JSON.stringify(this.layerManager.getLayers()));
		
		// Avoid saving identical consecutive states (optional but good)
		if (this.history.length > 0 && JSON.stringify(currentState) === JSON.stringify(this.history[this.historyIndex])) {
			// console.log("State unchanged, not saving.");
			return;
		}
		
		
		this.history.push(currentState);
		this.historyIndex++;
		
		// Limit history size
		if (this.history.length > this.maxHistory) {
			this.history.shift();
			this.historyIndex--;
		}
		
		// console.log("State Saved. Index:", this.historyIndex, "History Length:", this.history.length);
		this.onUpdate(); // Notify UI to update buttons
	}
	
	restoreState(stateIndex) {
		if (stateIndex < 0 || stateIndex >= this.history.length) {
			console.error("Invalid history index:", stateIndex);
			return;
		}
		this.historyIndex = stateIndex;
		// Get state from history (needs deep clone before passing)
		const stateToRestore = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
		
		// Restore state using LayerManager
		this.layerManager.setLayers(stateToRestore); // LayerManager handles re-rendering
		
		// console.log("State Restored. Index:", this.historyIndex);
		this.onUpdate(); // Notify UI to update buttons
	}
	
	undo() {
		if (this.canUndo()) {
			this.restoreState(this.historyIndex - 1);
		}
	}
	
	redo() {
		if (this.canRedo()) {
			this.restoreState(this.historyIndex + 1);
		}
	}
	
	canUndo() {
		return this.historyIndex > 0;
	}
	
	canRedo() {
		return this.historyIndex < this.history.length - 1;
	}
	
	clear() {
		this.history = [];
		this.historyIndex = -1;
		this.onUpdate();
	}
}
