class SidebarItemManager {
	constructor(options) {
		// Selectors
		this.$templateList = $(options.templateListSelector);
		this.$coverList = $(options.coverListSelector);
		this.$coverSearch = $(options.coverSearchSelector);
		this.$elementList = $(options.elementListSelector);
		this.$uploadPreview = $(options.uploadPreviewSelector);
		this.$uploadInput = $(options.uploadInputSelector);
		this.$addImageBtn = $(options.addImageBtnSelector);
		this.$sidebarContent = this.$coverList.closest('.sidebar-content'); // Get the scrollable container
		
		// Callbacks & Dependencies (ADDED layerManager and canvasManager)
		this.applyTemplate = options.applyTemplate; // Function provided by App.js
		this.addLayer = options.addLayer;           // Function provided by App.js (points to layerManager.addLayer)
		this.saveState = options.saveState;         // Function provided by App.js (points to historyManager.saveState)
		this.layerManager = options.layerManager;   // Instance of LayerManager
		this.canvasManager = options.canvasManager; // Instance of CanvasManager
		
		// State
		this.uploadedFile = null;
		this.allCoversData = [];
		this.filteredCoversData = [];
		this.coversToShow = 12;
		this.currentlyDisplayedCovers = 0;
		this.isLoadingCovers = false;
		this.currentSearchTerm = '';
		this.searchTimeout = null;
		this.searchDelay = 300;
	}
	
	loadAll() {
		this.loadTemplates();
		this.loadCovers();
		this.loadElements();
		this.initializeUpload();
	}
	
	// --- Templates ---
	loadTemplates() {
		try {
			const templateDataElement = document.getElementById('templateData');
			const templates = JSON.parse(templateDataElement.textContent || '[]');
			this.$templateList.empty();
			if (templates.length === 0) {
				this.$templateList.html('<p class="text-muted p-2">No templates found.</p>');
				return;
			}
			const $newThumbs = $();
			const self = this; // For click handler context
			
			templates.forEach(template => {
				const $thumb = $(`
                    <div class="item-thumbnail template-thumbnail loading" title="${template.name}">
                        <div class="thumbnail-spinner-overlay">
                            <div class="spinner-border spinner-border-sm text-secondary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                        </div>
                        <img src="${template.thumbnailPath}" alt="${template.name}">
                        <span>${template.name}</span>
                    </div>
                `);
				$thumb.data('templateJsonPath', template.jsonPath);
				
				// --- CLICK HANDLER ---
				$thumb.on('click', function() {
					const jsonPath = $(this).data('templateJsonPath');
					if (jsonPath && self.applyTemplate) {
						console.log("Template clicked:", jsonPath);
						self.applyTemplate(jsonPath); // Call the function passed from App.js
					} else {
						console.error("Missing jsonPath or applyTemplate callback for template click.");
					}
				});
				// --- END CLICK HANDLER ---
				
				$newThumbs.push($thumb[0]);
			});
			this.$templateList.append($newThumbs);
			this._setupImageLoading($newThumbs);
		} catch (error) {
			console.error("Error loading templates:", error);
			this.$templateList.html('<p class="text-danger p-2">Error loading templates.</p>');
		}
	}
	
	// --- Covers ---
	loadCovers() {
		try {
			const coverDataElement = document.getElementById('coverData');
			this.allCoversData = JSON.parse(coverDataElement.textContent || '[]');
			this.filteredCoversData = this.allCoversData;
			if (this.allCoversData.length === 0) {
				this.$coverList.html('<p class="text-muted p-2">No covers found.</p>');
				return;
			}
			this.displayMoreCovers(true); // Initial display
			
			this.$coverSearch.on('input', () => {
				clearTimeout(this.searchTimeout);
				this.searchTimeout = setTimeout(() => {
					this.currentSearchTerm = this.$coverSearch.val().toLowerCase().trim();
					this.filterCovers();
					this.displayMoreCovers(true);
				}, this.searchDelay);
			});
			
			this.$sidebarContent.on('scroll', () => {
				if ($('#coversPanel').hasClass('show') && !this.isLoadingCovers) {
					const container = this.$sidebarContent[0];
					const threshold = 200;
					if (container.scrollTop + container.clientHeight >= container.scrollHeight - threshold) {
						if (this.currentlyDisplayedCovers < this.filteredCoversData.length) {
							this.displayMoreCovers();
						}
					}
				}
			});
		} catch (error) {
			console.error("Error loading or parsing covers data:", error);
			this.$coverList.html('<p class="text-danger p-2">Error loading covers.</p>');
		}
	}
	
	filterCovers() {
		if (!this.currentSearchTerm) {
			this.filteredCoversData = this.allCoversData;
			return;
		}
		const searchKeywords = this.currentSearchTerm.split(/\s+/).filter(Boolean);
		this.filteredCoversData = this.allCoversData.filter(cover => {
			const coverKeywordsLower = cover.keywords.map(k => k.toLowerCase());
			return searchKeywords.every(searchTerm =>
				coverKeywordsLower.some(coverKeyword => coverKeyword.startsWith(searchTerm))
			);
		});
	}
	
	displayMoreCovers(reset = false) {
		if (this.isLoadingCovers && !reset) return;
		this.isLoadingCovers = true;
		
		if (reset) {
			this.$coverList.empty();
			this.currentlyDisplayedCovers = 0;
		}
		
		const coversToRender = this.filteredCoversData.slice(
			this.currentlyDisplayedCovers,
			this.currentlyDisplayedCovers + this.coversToShow
		);
		
		if (coversToRender.length === 0 && reset) {
			if (this.currentSearchTerm) {
				this.$coverList.html('<p class="text-muted p-2">No covers match your search.</p>');
			} else if (this.allCoversData.length === 0) {
				this.$coverList.html('<p class="text-muted p-2">No covers found.</p>');
			}
			this.isLoadingCovers = false;
			return;
		}
		
		if (coversToRender.length === 0 && !reset) {
			this.isLoadingCovers = false;
			return;
		}
		
		const $newThumbs = $();
		const self = this; // For click handler context
		
		coversToRender.forEach(cover => {
			const title = cover.caption ? `${cover.name} - ${cover.caption}` : cover.name;
			const $thumb = $(`
                <div class="item-thumbnail cover-thumbnail loading" title="${title}">
                    <div class="thumbnail-spinner-overlay">
                        <div class="spinner-border spinner-border-sm text-secondary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                    <img src="${cover.thumbnailPath}" alt="${cover.name}">
                    <span>${cover.name}</span>
                </div>
            `);
			$thumb.data('coverSrc', cover.imagePath);
			
			// --- CLICK HANDLER ---
			$thumb.on('click', function() {
				const imgSrc = $(this).data('coverSrc');
				if (imgSrc && self.addLayer && self.canvasManager && self.layerManager) {
					console.log("Cover clicked:", imgSrc);
					
					// --- Remove existing cover layers ---
					console.log("Applying cover, removing existing cover layers...");
					const existingLayers = self.layerManager.getLayers();
					const coverLayerIdsToDelete = existingLayers
						.filter(layer => layer.type === 'image' && layer.layerSubType === 'cover')
						.map(layer => layer.id);
					if (coverLayerIdsToDelete.length > 0) {
						coverLayerIdsToDelete.forEach(id => self.layerManager.deleteLayer(id, false)); // Delete without saving history yet
						console.log(`Removed ${coverLayerIdsToDelete.length} cover layers.`);
					} else {
						console.log("No existing cover layers found to remove.");
					}
					// --- End Remove ---
					
					const img = new Image();
					img.onload = () => {
						const canvasWidth = self.canvasManager.currentCanvasWidth;
						const canvasHeight = self.canvasManager.currentCanvasHeight;
						
						const newLayer = self.addLayer('image', {
							content: imgSrc,
							x: 0,
							y: 0,
							width: canvasWidth,
							height: canvasHeight,
							name: `Cover ${self.layerManager.uniqueIdCounter}`, // Use LayerManager's counter
							layerSubType: 'cover'
						});
						
						if (newLayer) {
							self.layerManager.moveLayer(newLayer.id, 'back');
							self.layerManager.toggleLockLayer(newLayer.id, false); // Don't save history yet
							self.layerManager.selectLayer(null);
							// self.layerManager.selectLayer(newLayer.id);
							self.saveState(); // Save history once at the end
						}
					};
					img.onerror = () => console.error("Failed to load cover image for clicking:", imgSrc);
					img.src = imgSrc;
				} else {
					console.error("Missing imgSrc, addLayer, canvasManager, or layerManager for cover click.");
				}
			});
			// --- END CLICK HANDLER ---
			
			$newThumbs.push($thumb[0]);
		});
		
		this.$coverList.append($newThumbs);
		this._setupImageLoading($newThumbs);
		this.currentlyDisplayedCovers += coversToRender.length;
		
		setTimeout(() => {
			this.isLoadingCovers = false;
		}, 100);
	}
	
	_setupImageLoading($thumbnails) {
		$thumbnails.each(function() {
			const $thumb = $(this);
			const $img = $thumb.find('img');
			const $spinnerOverlay = $thumb.find('.thumbnail-spinner-overlay');
			if ($img.length === 0) {
				$thumb.removeClass('loading').addClass('loaded');
				$spinnerOverlay.hide();
				return;
			}
			const img = $img[0];
			const onImageLoad = () => {
				$spinnerOverlay.hide();
				$thumb.removeClass('loading').addClass('loaded');
			};
			const onImageError = () => {
				console.error("Failed to load image:", img.src);
				$spinnerOverlay.html('<i class="fas fa-exclamation-triangle text-danger"></i>');
				$thumb.removeClass('loading').addClass('error');
			}
			if (img.complete) {
				onImageLoad();
			} else {
				$img.on('load', onImageLoad);
				$img.on('error', onImageError);
				if (img.complete) {
					onImageLoad();
					$img.off('load', onImageLoad);
					$img.off('error', onImageError);
				}
			}
		});
	}
	
	// --- Elements ---
	loadElements() {
		try {
			const elementDataElement = document.getElementById('elementData');
			const elements = JSON.parse(elementDataElement.textContent || '[]');
			this.$elementList.empty();
			if (elements.length === 0) {
				this.$elementList.html('<p class="text-muted p-2">No elements found.</p>');
				return;
			}
			const $newThumbs = $();
			const self = this; // For click handler context
			
			elements.forEach(element => {
				const $thumb = $(`
                    <div class="item-thumbnail element-thumbnail loading" title="${element.name}">
                        <div class="thumbnail-spinner-overlay">
                            <div class="spinner-border spinner-border-sm text-secondary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                        </div>
                        <img src="${element.image}" alt="${element.name}">
                    </div>
                `);
				$thumb.data('elementSrc', element.image);
				
				// --- CLICK HANDLER ---
				$thumb.on('click', function() {
					const imgSrc = $(this).data('elementSrc');
					if (imgSrc && self.addLayer && self.canvasManager && self.layerManager) {
						console.log("Element clicked:", imgSrc);
						const img = new Image();
						img.onload = () => {
							const elemWidth = Math.min(img.width, 150); // Default size
							const elemHeight = (img.height / img.width) * elemWidth;
							const canvasWidth = self.canvasManager.currentCanvasWidth;
							const canvasHeight = self.canvasManager.currentCanvasHeight;
							
							// Calculate center position
							const finalX = Math.max(0, (canvasWidth / 2) - (elemWidth / 2));
							const finalY = Math.max(0, (canvasHeight / 2) - (elemHeight / 2));
							
							const newLayer = self.addLayer('image', {
								content: imgSrc,
								x: finalX,
								y: finalY,
								width: elemWidth,
								height: elemHeight,
								layerSubType: 'element'
								// Name will be generated by addLayer if not provided
							});
							if (newLayer) {
								self.layerManager.selectLayer(newLayer.id);
								self.saveState();
							}
						};
						img.onerror = () => console.error("Failed to load element image for clicking:", imgSrc);
						img.src = imgSrc;
					} else {
						console.error("Missing imgSrc, addLayer, canvasManager, or layerManager for element click.");
					}
				});
				// --- END CLICK HANDLER ---
				
				$newThumbs.push($thumb[0]);
			});
			this.$elementList.append($newThumbs);
			// REMOVED: this._makeDraggable($newThumbs, { type: 'element' });
			this._setupImageLoading($newThumbs);
		} catch (error) {
			console.error("Error loading elements:", error);
			this.$elementList.html('<p class="text-danger p-2">Error loading elements.</p>');
		}
	}
	
	// --- Upload ---
	initializeUpload() {
		const self = this; // For click handler context
		
		this.$uploadInput.on('change', (event) => {
			const file = event.target.files[0];
			if (file && file.type.startsWith('image/')) {
				this.uploadedFile = file;
				const reader = new FileReader();
				reader.onload = (e) => {
					this.$uploadPreview.html(`<img src="${e.target.result}" alt="Upload Preview" style="max-width: 100%; max-height: 150px; object-fit: contain;">`);
					this.$addImageBtn.prop('disabled', false);
				}
				reader.readAsDataURL(file);
			} else {
				this.uploadedFile = null;
				this.$uploadPreview.empty();
				this.$addImageBtn.prop('disabled', true);
				if (file) alert('Please select a valid image file.');
			}
		});
		
		// --- MODIFIED CLICK HANDLER for "Add to Canvas" button ---
		this.$addImageBtn.on('click', () => {
			if (this.uploadedFile && self.addLayer && self.canvasManager && self.layerManager) {
				console.log("Add Uploaded Image clicked");
				const reader = new FileReader();
				reader.onload = (e) => {
					const img = new Image();
					img.onload = () => {
						// Add layer centered
						const canvasWidth = self.canvasManager.currentCanvasWidth;
						const canvasHeight = self.canvasManager.currentCanvasHeight;
						
						// Calculate default size (e.g., 80% of canvas width, max 300px)
						const maxWidth = Math.min(canvasWidth * 0.8, 300);
						let layerWidth = Math.min(img.width, maxWidth);
						const aspectRatio = img.height / img.width;
						let layerHeight = layerWidth * aspectRatio;
						
						// Ensure height doesn't exceed canvas bounds significantly
						const maxHeight = canvasHeight * 0.8;
						if (layerHeight > maxHeight) {
							layerHeight = maxHeight;
							layerWidth = layerHeight / aspectRatio;
						}
						
						// Calculate center position
						const layerX = Math.max(0, (canvasWidth - layerWidth) / 2);
						const layerY = Math.max(0, (canvasHeight - layerHeight) / 2);
						
						const newLayer = self.addLayer('image', {
							content: e.target.result, // Base64 data URL
							x: layerX,
							y: layerY,
							width: layerWidth,
							height: layerHeight,
							layerSubType: 'upload'
							// Name will be generated by addLayer
						});
						
						if (newLayer) {
							self.layerManager.selectLayer(newLayer.id);
							self.saveState();
						}
					};
					img.onerror = () => console.error("Failed to load uploaded image data for adding to canvas.");
					img.src = e.target.result; // Use the base64 data URL
				}
				reader.readAsDataURL(this.uploadedFile);
			} else {
				console.error("Missing uploadedFile, addLayer, canvasManager, or layerManager for upload button click.");
			}
		});
		// --- END MODIFIED CLICK HANDLER ---
	}
}
