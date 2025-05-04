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
		this.$overlayList = $(options.overlaysListSelector);
		this.$overlaySearch = $(options.overlaysSearchSelector);
		this.$sidebarContent = $(options.sidebarContentSelector);
		//
		// this.$overlayList = $('#overlayList'); // Added
		// this.$overlaySearch = $('#overlaySearch'); // Added
		// this.$sidebarContent = this.$coverList.closest('.sidebar-content');
		
		// Callbacks & Dependencies
		this.applyTemplate = options.applyTemplate;
		this.addLayer = options.addLayer;
		this.saveState = options.saveState;
		this.layerManager = options.layerManager;
		this.canvasManager = options.canvasManager;
		
		// State
		this.uploadedFile = null;
		// Cover State
		this.allCoversData = [];
		this.filteredCoversData = [];
		this.coversToShow = 12;
		this.currentlyDisplayedCovers = 0;
		this.isLoadingCovers = false;
		this.currentSearchTerm = '';
		this.searchTimeout = null;
		this.searchDelay = 300;
		
		// Overlay State
		this.allOverlaysData = [];
		this.filteredOverlaysData = [];
		this.overlaysToShow = 12;
		this.currentlyDisplayedOverlays = 0;
		this.isLoadingOverlays = false;
		this.currentOverlaySearchTerm = '';
		this.overlaySearchTimeout = null;
	}
	
	loadAll() {
		this.loadTemplates();
		this.loadCovers();
		this.loadElements();
		this.loadOverlays();
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
			const self = this;
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
				$thumb.on('click', function() {
					const jsonPath = $(this).data('templateJsonPath');
					if (jsonPath && self.applyTemplate) {
						console.log("Template clicked:", jsonPath);
						self.applyTemplate(jsonPath);
					} else {
						console.error("Missing jsonPath or applyTemplate callback for template click.");
					}
				});
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
					this.displayMoreCovers(true); // Reset display on new search
				}, this.searchDelay);
			});
			
			// Scroll listener remains the same, but logic inside needs update
			this.$sidebarContent.on('scroll', () => {
				const container = this.$sidebarContent[0];
				const threshold = 200; // Pixels from bottom to trigger load
				
				// Check if Covers panel is active and needs loading
				if ($('#coversPanel').hasClass('show') && !this.isLoadingCovers) {
					if (container.scrollTop + container.clientHeight >= container.scrollHeight - threshold) {
						if (this.currentlyDisplayedCovers < this.filteredCoversData.length) {
							this.displayMoreCovers();
						}
					}
				}
				// --- NEW: Check if Overlays panel is active and needs loading ---
				else if ($('#overlaysPanel').hasClass('show') && !this.isLoadingOverlays) {
					if (container.scrollTop + container.clientHeight >= container.scrollHeight - threshold) {
						if (this.currentlyDisplayedOverlays < this.filteredOverlaysData.length) {
							this.displayMoreOverlays();
						}
					}
				}
				// --- END NEW ---
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
				coverKeywordsLower.some(coverKeyword => coverKeyword.includes(searchTerm)) // Use includes for partial match
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
			return; // No more covers to load
		}
		
		
		const $newThumbs = $();
		const self = this;
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
			$thumb.on('click', function() {
				const imgSrc = $(this).data('coverSrc');
				if (imgSrc && self.addLayer && self.canvasManager && self.layerManager) {
					console.log("Cover clicked:", imgSrc);
					// Remove existing cover layers
					console.log("Applying cover, removing existing cover layers...");
					const existingLayers = self.layerManager.getLayers();
					const coverLayerIdsToDelete = existingLayers
						.filter(layer => layer.type === 'image' && layer.layerSubType === 'cover')
						.map(layer => layer.id);
					if (coverLayerIdsToDelete.length > 0) {
						coverLayerIdsToDelete.forEach(id => self.layerManager.deleteLayer(id, false));
						console.log(`Removed ${coverLayerIdsToDelete.length} cover layers.`);
					} else {
						console.log("No existing cover layers found to remove.");
					}
					
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
							name: `Cover ${self.layerManager.uniqueIdCounter}`,
							layerSubType: 'cover'
						});
						if (newLayer) {
							self.layerManager.moveLayer(newLayer.id, 'back');
							self.layerManager.toggleLockLayer(newLayer.id, false);
							self.layerManager.selectLayer(null);
							self.saveState();
						}
					};
					img.onerror = () => console.error("Failed to load cover image for clicking:", imgSrc);
					img.src = imgSrc;
				} else {
					console.error("Missing imgSrc, addLayer, canvasManager, or layerManager for cover click.");
				}
			});
			$newThumbs.push($thumb[0]);
		});
		
		this.$coverList.append($newThumbs);
		this._setupImageLoading($newThumbs);
		this.currentlyDisplayedCovers += coversToRender.length;
		setTimeout(() => { this.isLoadingCovers = false; }, 100); // Short delay to prevent rapid re-triggering
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
			const self = this;
			elements.forEach(element => {
				const $thumb = $(`
                    <div class="item-thumbnail element-thumbnail loading" title="${element.name}">
                        <div class="thumbnail-spinner-overlay">
                            <div class="spinner-border spinner-border-sm text-secondary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                        </div>
                        <img src="${element.image}" alt="${element.name}">
                        <!-- No span for name below element -->
                    </div>
                `);
				$thumb.data('elementSrc', element.image);
				$thumb.on('click', function() {
					const imgSrc = $(this).data('elementSrc');
					if (imgSrc && self.addLayer && self.canvasManager && self.layerManager) {
						console.log("Element clicked:", imgSrc);
						const img = new Image();
						img.onload = () => {
							const elemWidth = Math.min(img.width, 150);
							const elemHeight = (img.height / img.width) * elemWidth;
							const canvasWidth = self.canvasManager.currentCanvasWidth;
							const canvasHeight = self.canvasManager.currentCanvasHeight;
							const finalX = Math.max(0, (canvasWidth / 2) - (elemWidth / 2));
							const finalY = Math.max(0, (canvasHeight / 2) - (elemHeight / 2));
							const newLayer = self.addLayer('image', {
								content: imgSrc,
								x: finalX,
								y: finalY,
								width: elemWidth,
								height: elemHeight,
								layerSubType: 'element'
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
				$newThumbs.push($thumb[0]);
			});
			this.$elementList.append($newThumbs);
			this._setupImageLoading($newThumbs);
		} catch (error) {
			console.error("Error loading elements:", error);
			this.$elementList.html('<p class="text-danger p-2">Error loading elements.</p>');
		}
	}
	
	// --- Overlays --- START NEW ---
	loadOverlays() {
		try {
			const overlayDataElement = document.getElementById('overlayData');
			this.allOverlaysData = JSON.parse(overlayDataElement.textContent || '[]');
			this.filteredOverlaysData = this.allOverlaysData;
			
			if (this.allOverlaysData.length === 0) {
				this.$overlayList.html('<p class="text-muted p-2">No overlays found.</p>');
				return;
			}
			
			this.displayMoreOverlays(true); // Initial display
			
			// Search listener
			this.$overlaySearch.on('input', () => {
				clearTimeout(this.overlaySearchTimeout);
				this.overlaySearchTimeout = setTimeout(() => {
					this.currentOverlaySearchTerm = this.$overlaySearch.val().toLowerCase().trim();
					this.filterOverlays();
					this.displayMoreOverlays(true); // Reset display on new search
				}, this.searchDelay);
			});
			
			// Scroll listener is already set up in loadCovers, just need the logic inside it
			
		} catch (error) {
			console.error("Error loading or parsing overlays data:", error);
			this.$overlayList.html('<p class="text-danger p-2">Error loading overlays.</p>');
		}
	}
	
	filterOverlays() {
		if (!this.currentOverlaySearchTerm) {
			this.filteredOverlaysData = this.allOverlaysData;
			return;
		}
		const searchKeywords = this.currentOverlaySearchTerm.split(/\s+/).filter(Boolean);
		this.filteredOverlaysData = this.allOverlaysData.filter(overlay => {
			const overlayKeywordsLower = overlay.keywords.map(k => k.toLowerCase());
			return searchKeywords.every(searchTerm =>
				overlayKeywordsLower.some(overlayKeyword => overlayKeyword.includes(searchTerm)) // Use includes for partial match
			);
		});
	}
	
	displayMoreOverlays(reset = false) {
		if (this.isLoadingOverlays && !reset) return;
		this.isLoadingOverlays = true;
		
		if (reset) {
			this.$overlayList.empty();
			this.currentlyDisplayedOverlays = 0;
		}
		
		const overlaysToRender = this.filteredOverlaysData.slice(
			this.currentlyDisplayedOverlays,
			this.currentlyDisplayedOverlays + this.overlaysToShow
		);
		
		if (overlaysToRender.length === 0 && reset) {
			if (this.currentOverlaySearchTerm) {
				this.$overlayList.html('<p class="text-muted p-2">No overlays match your search.</p>');
			} else if (this.allOverlaysData.length === 0) {
				this.$overlayList.html('<p class="text-muted p-2">No overlays found.</p>');
			}
			this.isLoadingOverlays = false;
			return;
		}
		if (overlaysToRender.length === 0 && !reset) {
			this.isLoadingOverlays = false;
			return; // No more overlays to load
		}
		
		const $newThumbs = $();
		const self = this;
		overlaysToRender.forEach(overlay => {
			const $thumb = $(`
                <div class="item-thumbnail overlay-thumbnail loading" title="${overlay.name}">
                     <div class="thumbnail-spinner-overlay">
                        <div class="spinner-border spinner-border-sm text-secondary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                    <img src="${overlay.thumbnailPath}" alt="${overlay.name}">
                    <!-- No span for name below overlay -->
                </div>
            `);
			// Store the ACTUAL image path (not the thumbnail)
			$thumb.data('overlaySrc', overlay.imagePath);
			
			$thumb.on('click', function() {
				const imgSrc = $(this).data('overlaySrc');
				if (imgSrc && self.addLayer && self.canvasManager && self.layerManager) {
					console.log("Overlay clicked:", imgSrc);
					
					// --- Confirmation Logic ---
					const existingLayers = self.layerManager.getLayers();
					const existingOverlayIds = existingLayers
						.filter(layer => layer.type === 'image' && layer.layerSubType === 'overlay')
						.map(layer => layer.id);
					
					let deleteConfirmed = true; // Assume deletion if none exist
					if (existingOverlayIds.length > 0) {
						deleteConfirmed = confirm("Remove existing overlay layer(s) before adding this one?");
						if (deleteConfirmed) {
							console.log(`Removing ${existingOverlayIds.length} existing overlay layers.`);
							existingOverlayIds.forEach(id => self.layerManager.deleteLayer(id, false)); // Don't save history yet
						} else {
							console.log("Keeping existing overlay layers.");
						}
					}
					
					const img = new Image();
					img.onload = () => {
						const canvasWidth = self.canvasManager.currentCanvasWidth;
						const canvasHeight = self.canvasManager.currentCanvasHeight;
						const imgWidth = img.width;
						const imgHeight = img.height;
						
						// Calculate centered position
						const finalX = (canvasWidth - imgWidth) / 2;
						const finalY = (canvasHeight - imgHeight) / 2;
						
						const newLayer = self.addLayer('image', {
							content: imgSrc,
							x: finalX,
							y: finalY,
							width: imgWidth,
							height: imgHeight,
							blendMode: 'overlay', // Set blend mode
							layerSubType: 'overlay', // Set subtype
							name: `Overlay ${self.layerManager.uniqueIdCounter}` // Generate name
						});
						
						if (newLayer) {
							// --- Positioning Logic ---
							const allLayers = self.layerManager.getLayers(); // Get layers *after* adding
							const coverLayers = allLayers.filter(l => l.type === 'image' && l.layerSubType === 'cover');
							const coverZIndex = coverLayers.length > 0 ? Math.max(...coverLayers.map(l => l.zIndex || 0)) : 0;
							const targetZIndex = coverZIndex + 1; // Place just above the highest cover layer
							
							console.log(`Positioning new overlay ${newLayer.id} at zIndex ${targetZIndex}`);
							
							// Update zIndex values in the LayerManager's internal array
							// Find the actual layer object in the manager's array
							const addedLayerInData = self.layerManager.layers.find(l => l.id === newLayer.id);
							if (addedLayerInData) {
								// Shift other layers up to make space
								self.layerManager.layers.forEach(layer => {
									if (layer.zIndex >= targetZIndex && layer.id !== newLayer.id) {
										layer.zIndex++;
									}
								});
								// Set the target zIndex for the new layer
								addedLayerInData.zIndex = targetZIndex;
							} else {
								console.error("Could not find newly added layer in internal array for zIndex update.");
							}
							
							// Apply the updated z-indices to the DOM elements and update the list
							self.layerManager._updateZIndices();
							self.layerManager.updateList();
							// --- End Positioning ---
							
							self.layerManager.selectLayer(newLayer.id); // Select the new layer
							self.saveState(); // Save history after all changes
						}
					};
					img.onerror = () => console.error("Failed to load overlay image for clicking:", imgSrc);
					img.src = imgSrc; // Load the actual image to get dimensions
				} else {
					console.error("Missing imgSrc, addLayer, canvasManager, or layerManager for overlay click.");
				}
			});
			// --- END CLICK HANDLER ---
			
			$newThumbs.push($thumb[0]);
		});
		
		this.$overlayList.append($newThumbs);
		this._setupImageLoading($newThumbs); // Reuse existing image loading logic
		this.currentlyDisplayedOverlays += overlaysToRender.length;
		setTimeout(() => { this.isLoadingOverlays = false; }, 100); // Short delay
	}
	// --- Overlays --- END NEW ---
	
	
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
				$spinnerOverlay.html('<i class="fas fa-exclamation-triangle text-danger"></i>'); // Show error icon
				$thumb.removeClass('loading').addClass('error');
			}
			
			// Check if image is already loaded (cached)
			if (img.complete) {
				onImageLoad();
			} else {
				$img.on('load', onImageLoad);
				$img.on('error', onImageError);
				// Double-check completion status after attaching listeners
				// in case it loaded between the check and listener attachment
				if (img.complete) {
					onImageLoad();
					$img.off('load', onImageLoad); // Clean up listeners
					$img.off('error', onImageError);
				}
			}
		});
	}
	
	// --- Upload ---
	initializeUpload() {
		const self = this;
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
		
		this.$addImageBtn.on('click', () => {
			if (this.uploadedFile && self.addLayer && self.canvasManager && self.layerManager) {
				console.log("Add Uploaded Image clicked");
				const reader = new FileReader();
				reader.onload = (e) => {
					const img = new Image();
					img.onload = () => {
						const canvasWidth = self.canvasManager.currentCanvasWidth;
						const canvasHeight = self.canvasManager.currentCanvasHeight;
						const maxWidth = Math.min(canvasWidth * 0.8, 300);
						let layerWidth = Math.min(img.width, maxWidth);
						const aspectRatio = img.height / img.width;
						let layerHeight = layerWidth * aspectRatio;
						const maxHeight = canvasHeight * 0.8;
						if (layerHeight > maxHeight) {
							layerHeight = maxHeight;
							layerWidth = layerHeight / aspectRatio;
						}
						const layerX = Math.max(0, (canvasWidth - layerWidth) / 2);
						const layerY = Math.max(0, (canvasHeight - layerHeight) / 2);
						const newLayer = self.addLayer('image', {
							content: e.target.result,
							x: layerX,
							y: layerY,
							width: layerWidth,
							height: layerHeight,
							layerSubType: 'upload'
						});
						if (newLayer) {
							self.layerManager.selectLayer(newLayer.id);
							self.saveState();
						}
					};
					img.onerror = () => console.error("Failed to load uploaded image data for adding to canvas.");
					img.src = e.target.result;
				}
				reader.readAsDataURL(this.uploadedFile);
			} else {
				console.error("Missing uploadedFile, addLayer, canvasManager, or layerManager for upload button click.");
			}
		});
	}
}
