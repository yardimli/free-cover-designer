// free-cover-designer/js/SidebarItemManager.js
class SidebarItemManager {
	constructor(options) {
		// Callbacks & Dependencies
		this.applyTemplate = options.applyTemplate;
		this.addLayer = options.addLayer;
		this.saveState = options.saveState;
		this.layerManager = options.layerManager;
		this.canvasManager = options.canvasManager;
		this.showLoadingOverlay = options.showLoadingOverlay || function (msg) {
			console.warn("showLoadingOverlay not provided", msg);
		};
		this.hideLoadingOverlay = options.hideLoadingOverlay || function () {
			console.warn("hideLoadingOverlay not provided");
		};
		
		// Upload specific elements
		this.$uploadPreview = $(options.uploadPreviewSelector);
		this.$uploadInput = $(options.uploadInputSelector);
		this.$addImageBtn = $(options.addImageBtnSelector);
		this.uploadedFile = null;
		this.coverTypes = []; // To store fetched cover types
		
		// Modal reference
		this.$overlayConfirmModalElement = $('#overlayConfirmModal');
		this.overlayConfirmModal = null; // Will be initialized Bootstrap modal instance
		this.pendingOverlayData = null; // To store itemData for modal
		
		this.defaultCoverTypeId = options.defaultCoverTypeId || null; // Store the default ID
		
		// Configuration for different item types
		this.itemTypesConfig = {
			templates: {
				type: 'templates',
				dataElementId: 'templateData',
				listSelector: '#templateList',
				searchSelector: '#templateSearch',
				coverTypeFilterSelector: '#templateTypeFilter',
				selectedCoverTypeId: '', // Will be set in loadItems
				scrollAreaSelector: '#templatesPanel .panel-scrollable-content',
				itemsToShow: 12,
				allData: [],
				filteredData: [],
				currentlyDisplayed: 0,
				isLoading: false,
				searchTerm: '',
				searchTimeout: null,
				searchDelay: 300,
				thumbnailClass: 'template-thumbnail',
				gridColumns: 2,
				createThumbnail: (item) => `
                    <div class="item-thumbnail col-6 loading" title="${item.name}">
                        <div class="thumbnail-spinner-overlay">
                            <div class="spinner-border spinner-border-sm text-secondary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                        </div>
                        <div class="${this.itemTypesConfig.templates.thumbnailClass}">
                            <img src="${item.thumbnailPath}" alt="${item.name}">
                        </div>
                        <span>${item.name}</span>
                    </div>
                `,
				handleClick: (itemData, manager) => {
					if (itemData.jsonData && manager.applyTemplate) {
						console.log("Template clicked, applying data for:", itemData.name);
						manager.applyTemplate(itemData.jsonData);
						this.closeSidebarPanel();
					} else {
						console.error("Missing jsonData or applyTemplate callback for template click.", itemData);
					}
				},
				filterFn: (item, term) => {
					if (!term) return true;
					return item.name.toLowerCase().includes(term);
				}
			},
			covers: {
				type: 'covers',
				dataElementId: 'coverData',
				listSelector: '#coverList',
				searchSelector: '#coverSearch',
				coverTypeFilterSelector: '#coverTypeFilter',
				selectedCoverTypeId: '', // Will be set in loadItems
				scrollAreaSelector: '#coversPanel .panel-scrollable-content',
				itemsToShow: 12,
				allData: [],
				filteredData: [],
				currentlyDisplayed: 0,
				isLoading: false,
				searchTerm: '',
				searchTimeout: null,
				searchDelay: 300,
				thumbnailClass: 'cover-thumbnail',
				gridColumns: 2,
				createThumbnail: (item) => {
					const title = item.caption ? `${item.name} - ${item.caption}` : item.name;
					return `
                        <div class="item-thumbnail col-6 loading" title="${title}">
                            <div class="thumbnail-spinner-overlay">
                                <div class="spinner-border spinner-border-sm text-secondary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                            </div>
                            <div class="${this.itemTypesConfig.covers.thumbnailClass}">
                                <img src="${item.thumbnailPath}" alt="${item.name}">
                            </div>
                            <span>${item.name}</span>
                        </div>
                    `;
				},
				handleClick: (itemData, manager) => {
					const imgSrc = itemData.imagePath;
					if (imgSrc && manager.addLayer && manager.canvasManager && manager.layerManager && manager.showLoadingOverlay && manager.hideLoadingOverlay) {
						console.log("Cover clicked:", imgSrc);
						manager.showLoadingOverlay("Adding cover...");
						console.log("Applying cover, removing existing cover layers...");
						const existingLayers = manager.layerManager.getLayers();
						const coverLayerIdsToDelete = existingLayers
							.filter(layer => layer.type === 'image' && layer.layerSubType === 'cover')
							.map(layer => layer.id);
						
						if (coverLayerIdsToDelete.length > 0) {
							coverLayerIdsToDelete.forEach(id => manager.layerManager.deleteLayer(id, false));
							console.log(`Removed ${coverLayerIdsToDelete.length} cover layers.`);
						} else {
							console.log("No existing cover layers found to remove.");
						}
						
						const img = new Image();
						img.onload = () => {
							try {
								const canvasWidth = manager.canvasManager.currentCanvasWidth;
								const canvasHeight = manager.canvasManager.currentCanvasHeight;
								const newLayer = manager.addLayer('image', {
									content: imgSrc,
									x: 0,
									y: 0,
									width: canvasWidth,
									height: canvasHeight,
									name: `Cover ${manager.layerManager.uniqueIdCounter}`,
									layerSubType: 'cover'
								});
								if (newLayer) {
									manager.layerManager.moveLayer(newLayer.id, 'back');
									manager.layerManager.toggleLockLayer(newLayer.id, false);
									manager.layerManager.selectLayer(null);
									manager.saveState();
									this.closeSidebarPanel();
								}
							} catch (error) {
								console.error("Error processing cover image:", error);
								alert("Error adding cover. Please try again.");
							} finally {
								manager.hideLoadingOverlay();
							}
						};
						img.onerror = () => {
							console.error("Failed to load cover image for clicking:", imgSrc);
							alert("Failed to load cover image. Please check the image path or try again.");
							manager.hideLoadingOverlay();
						};
						img.src = imgSrc;
					} else {
						console.error("Missing dependencies for cover click (imgSrc, addLayer, canvasManager, layerManager, or overlay functions).");
					}
				},
				filterFn: (item, term) => {
					if (!term) return true;
					const searchKeywords = term.split(/\s+/).filter(Boolean);
					const itemKeywordsLower = (item.keywords || []).map(k => k.toLowerCase());
					const nameLower = item.name.toLowerCase();
					return searchKeywords.every(searchTermPart =>
						itemKeywordsLower.some(itemKeyword => itemKeyword.includes(searchTermPart)) ||
						nameLower.includes(searchTermPart)
					);
				}
			},
			elements: {
				type: 'elements',
				dataElementId: 'elementData',
				listSelector: '#elementList',
				searchSelector: '#elementSearch',
				scrollAreaSelector: '#elementsPanel .panel-scrollable-content',
				itemsToShow: 12,
				allData: [],
				filteredData: [],
				currentlyDisplayed: 0,
				isLoading: false,
				searchTerm: '',
				searchTimeout: null,
				searchDelay: 300,
				thumbnailClass: 'element-thumbnail',
				gridColumns: 2,
				createThumbnail: (item) => {
					const title = item.caption ? `${item.name} - ${item.caption}` : item.name;
					return `
                        <div class="item-thumbnail col-6 loading" title="${title}">
                            <div class="thumbnail-spinner-overlay">
                                <div class="spinner-border spinner-border-sm text-secondary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                            </div>
                            <div class="${this.itemTypesConfig.elements.thumbnailClass}">
                                <img src="${item.thumbnailPath}" alt="${item.name}">
                            </div>
                            <span>${item.name}</span>
                        </div>
                    `;
				},
				handleClick: (itemData, manager) => {
					const imgSrc = itemData.imagePath;
					if (imgSrc && manager.addLayer && manager.canvasManager && manager.layerManager && manager.showLoadingOverlay && manager.hideLoadingOverlay) {
						console.log("Element clicked:", imgSrc);
						manager.showLoadingOverlay("Adding element...");
						const img = new Image();
						img.onload = () => {
							try {
								const elemWidth = Math.min(img.width, 150);
								const elemHeight = (img.height / img.width) * elemWidth;
								const canvasWidth = manager.canvasManager.currentCanvasWidth;
								const canvasHeight = manager.canvasManager.currentCanvasHeight;
								const finalX = Math.max(0, (canvasWidth / 2) - (elemWidth / 2));
								const finalY = Math.max(0, (canvasHeight / 2) - (elemHeight / 2));
								const newLayer = manager.addLayer('image', {
									content: imgSrc,
									x: finalX,
									y: finalY,
									width: elemWidth,
									height: elemHeight,
									layerSubType: 'element',
									name: `${itemData.name} ${manager.layerManager.uniqueIdCounter}`
								});
								if (newLayer) {
									manager.layerManager.selectLayer(newLayer.id);
									manager.saveState();
									this.closeSidebarPanel();
								}
							} catch (error) {
								console.error("Error processing element image:", error);
								alert("Error adding element. Please try again.");
							} finally {
								manager.hideLoadingOverlay();
							}
						};
						img.onerror = () => {
							console.error("Failed to load element image for clicking:", imgSrc);
							alert("Failed to load element image. Please check the image path or try again.");
							manager.hideLoadingOverlay();
						};
						img.src = imgSrc;
					} else {
						console.error("Missing imgSrc, addLayer, canvasManager, or layerManager for element click.");
					}
				},
				filterFn: (item, term) => {
					if (!term) return true;
					const searchKeywords = term.split(/\s+/).filter(Boolean);
					const itemKeywordsLower = (item.keywords || []).map(k => k.toLowerCase());
					const nameLower = item.name.toLowerCase();
					return searchKeywords.every(searchTermPart =>
						itemKeywordsLower.some(itemKeyword => itemKeyword.includes(searchTermPart)) ||
						nameLower.includes(searchTermPart)
					);
				}
			},
			overlays: {
				type: 'overlays',
				dataElementId: 'overlayData',
				listSelector: '#overlayList',
				searchSelector: '#overlaySearch',
				scrollAreaSelector: '#overlaysPanel .panel-scrollable-content',
				itemsToShow: 12,
				allData: [],
				filteredData: [],
				currentlyDisplayed: 0,
				isLoading: false,
				searchTerm: '',
				searchTimeout: null,
				searchDelay: 300,
				thumbnailClass: 'overlay-thumbnail',
				gridColumns: 2,
				createThumbnail: (item) => {
					const title = item.caption ? `${item.name} - ${item.caption}` : item.name;
					return `
                        <div class="item-thumbnail col-6 loading" title="${title}">
                            <div class="thumbnail-spinner-overlay">
                                <div class="spinner-border spinner-border-sm text-secondary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                            </div>
                            <div class="${this.itemTypesConfig.overlays.thumbnailClass}">
                                <img src="${item.thumbnailPath}" alt="${item.name}">
                            </div>
                            <span>${item.name}</span>
                        </div>
                    `;
				},
				handleClick: (itemData, manager) => {
					// `manager` is `this` (SidebarItemManager instance)
					const imgSrc = itemData.imagePath;
					if (!imgSrc || !manager.addLayer || !manager.canvasManager || !manager.layerManager || !manager.showLoadingOverlay || !manager.hideLoadingOverlay) {
						console.error("Missing dependencies for overlay click.");
						return;
					}
					console.log("Overlay clicked:", imgSrc);
					
					const existingLayers = manager.layerManager.getLayers();
					const existingOverlayIds = existingLayers
						.filter(layer => layer.type === 'image' && layer.layerSubType === 'overlay')
						.map(layer => layer.id);
					
					if (existingOverlayIds.length > 0) {
						// Store data for modal handlers
						manager.pendingOverlayData = {itemData, existingOverlayIds};
						// Show the modal
						if (manager.overlayConfirmModal) {
							manager.overlayConfirmModal.show();
						} else {
							console.error("Overlay confirmation modal not initialized. Falling back to confirm().");
							// Fallback to confirm if modal is broken
							if (confirm("An overlay already exists. Replace existing overlay(s)? Click OK to replace, Cancel to add as new.")) {
								manager._proceedWithAddingOverlay(itemData, true); // replace = true
							} else {
								manager._proceedWithAddingOverlay(itemData, false); // replace = false
							}
						}
					} else {
						// No existing overlays, proceed directly
						manager._proceedWithAddingOverlay(itemData, false); // replace = false (doesn't matter here)
					}
				},
				filterFn: (item, term) => {
					if (!term) return true;
					const searchKeywords = term.split(/\s+/).filter(Boolean);
					const itemKeywordsLower = (item.keywords || []).map(k => k.toLowerCase());
					const nameLower = item.name.toLowerCase();
					return searchKeywords.every(searchTermPart =>
						itemKeywordsLower.some(itemKeyword => itemKeyword.includes(searchTermPart)) ||
						nameLower.includes(searchTermPart)
					);
				}
			}
		};
	}
	
	// New private method to handle the actual overlay addition
	_proceedWithAddingOverlay(itemData, replaceExisting) {
		const manager = this; // `this` is SidebarItemManager instance
		const imgSrc = itemData.imagePath;
		
		if (replaceExisting && manager.pendingOverlayData && manager.pendingOverlayData.existingOverlayIds) {
			console.log(`Removing ${manager.pendingOverlayData.existingOverlayIds.length} existing overlay layers.`);
			manager.pendingOverlayData.existingOverlayIds.forEach(id => manager.layerManager.deleteLayer(id, false)); // Don't save history for each deletion here
		}
		
		manager.showLoadingOverlay("Adding overlay...");
		const img = new Image();
		img.onload = () => {
			try {
				const canvasWidth = manager.canvasManager.currentCanvasWidth;
				const canvasHeight = manager.canvasManager.currentCanvasHeight;
				let layerWidth = img.width;
				let layerHeight = img.height;
				
				// Optional: Scale down if larger than canvas, maintaining aspect ratio
				if (img.width > canvasWidth || img.height > canvasHeight) {
					const scaleFactor = Math.min(canvasWidth / img.width, canvasHeight / img.height);
					layerWidth = img.width * scaleFactor;
					layerHeight = img.height * scaleFactor;
				}
				
				const finalX = (canvasWidth - layerWidth) / 2;
				const finalY = (canvasHeight - layerHeight) / 2;
				
				const newLayer = manager.addLayer('image', {
					content: imgSrc,
					x: finalX,
					y: finalY,
					width: layerWidth,
					height: layerHeight,
					blendMode: 'overlay',
					layerSubType: 'overlay',
					name: `Overlay ${manager.layerManager.uniqueIdCounter}`
				});
				
				if (newLayer) {
					const addedLayerData = manager.layerManager.getLayerById(newLayer.id);
					if (addedLayerData) {
						const allCurrentLayers = manager.layerManager.layers; // Use the live array
						const coverLayers = allCurrentLayers.filter(l => l.type === 'image' && l.layerSubType === 'cover');
						const maxCoverZIndex = coverLayers.length > 0 ? Math.max(0, ...coverLayers.map(l => l.zIndex || 0)) : 0;
						let targetZIndex = maxCoverZIndex + 1;
						
						// Shift layers that would be at or above the targetZIndex to make space
						allCurrentLayers.forEach(layer => {
							if (layer.id !== addedLayerData.id && (layer.zIndex || 0) >= targetZIndex) {
								layer.zIndex = (layer.zIndex || 0) + 1;
							}
						});
						addedLayerData.zIndex = targetZIndex;
						console.log(`Positioning new overlay ${addedLayerData.id} at zIndex ${targetZIndex}`);
					} else {
						console.error("Could not find newly added layer in internal array for zIndex update.");
					}
					
					manager.layerManager._updateZIndices(); // Sorts internal array by zIndex and updates CSS
					manager.layerManager.updateList();
					manager.layerManager.selectLayer(newLayer.id);
					manager.saveState(); // Save history once after all changes
					this.closeSidebarPanel();
				}
			} catch (error) {
				console.error("Error processing overlay image:", error);
				alert("Error adding overlay. Please try again.");
			} finally {
				manager.hideLoadingOverlay();
				manager.pendingOverlayData = null; // Clear pending data
			}
		};
		img.onerror = () => {
			console.error("Failed to load overlay image for clicking:", imgSrc);
			alert("Failed to load overlay image. Please check the image path or try again.");
			manager.hideLoadingOverlay();
			manager.pendingOverlayData = null; // Clear pending data
		};
		img.src = imgSrc;
	}
	
	closeSidebarPanel() {
		const $sidebarPanelsContainer = $('#sidebar-panels-container');
		const $sidebarNavLinks = $('.sidebar-nav .nav-link[data-panel-target]');
		$sidebarPanelsContainer.removeClass('open');
		$sidebarNavLinks.removeClass('active');
	}
	
	loadAll() {
		try {
			const coverTypesDataElement = document.getElementById('coverTypesData');
			if (coverTypesDataElement) {
				this.coverTypes = JSON.parse(coverTypesDataElement.textContent || '[]');
			} else {
				console.warn("Cover types data element (#coverTypesData) not found.");
			}
		} catch (error) {
			console.error("Error parsing cover types data:", error);
			this.coverTypes = [];
		}
		Object.keys(this.itemTypesConfig).forEach(type => {
			this.loadItems(type);
		});
		this.initializeUpload();
		this.initializeOverlayConfirmModal();
	}
	
	initializeOverlayConfirmModal() {
		if (this.$overlayConfirmModalElement.length) {
			this.overlayConfirmModal = new bootstrap.Modal(this.$overlayConfirmModalElement[0]);
			
			this.$overlayConfirmModalElement.find('#replaceOverlayBtn').off('click').on('click', () => {
				if (this.pendingOverlayData && this.pendingOverlayData.itemData) {
					this._proceedWithAddingOverlay(this.pendingOverlayData.itemData, true); // replace = true
				}
				this.overlayConfirmModal.hide();
			});
			
			this.$overlayConfirmModalElement.find('#addOverlayAsNewBtn').off('click').on('click', () => {
				if (this.pendingOverlayData && this.pendingOverlayData.itemData) {
					this._proceedWithAddingOverlay(this.pendingOverlayData.itemData, false); // replace = false
				}
				this.overlayConfirmModal.hide();
			});
			this.$overlayConfirmModalElement.off('hidden.bs.modal').on('hidden.bs.modal', () => {
				this.pendingOverlayData = null; // Clear pending data when modal is hidden
			});
		} else {
			console.error("Overlay confirmation modal element (#overlayConfirmModal) not found for initialization.");
		}
	}
	
	loadItems(type) {
		const config = this.itemTypesConfig[type];
		if (!config) {
			console.error(`Invalid item type "${type}" requested for loading.`);
			return;
		}
		const $list = $(config.listSelector);
		if (!$list.length) {
			console.error(`List container not found for type "${type}": ${config.listSelector}`);
			return;
		}
		
		try {
			const dataElement = document.getElementById(config.dataElementId);
			if (!dataElement) {
				throw new Error(`Data element not found: #${config.dataElementId}`);
			}
			config.allData = JSON.parse(dataElement.textContent || '[]');
			// config.filteredData will be set by filterItems
			
			if (config.allData.length === 0) {
				$list.html(`<p class="text-muted p-2">No ${type} found.</p>`);
			}
			
			if (config.coverTypeFilterSelector && (type === 'covers' || type === 'templates')) {
				const $filterSelect = $(config.coverTypeFilterSelector);
				if ($filterSelect.length) {
					$filterSelect.empty(); // Clear any pre-existing options
					let defaultSelected = false;
					let firstOptionValue = null;
					
					if (this.coverTypes.length > 0) {
						this.coverTypes.forEach((coverType, index) => {
							const optionValue = coverType.id.toString();
							const optionText = coverType.type_name;
							const $option = new Option(optionText, optionValue);
							
							if (index === 0) {
								firstOptionValue = optionValue; // Store the first available option value
							}
							
							if (this.defaultCoverTypeId && optionValue === this.defaultCoverTypeId.toString()) {
								$option.selected = true;
								config.selectedCoverTypeId = optionValue;
								defaultSelected = true;
							}
							$filterSelect.append($option);
						});
						
						// If defaultCoverTypeId was not found or not provided, and there are types, select the first one
						if (!defaultSelected && firstOptionValue) {
							$filterSelect.val(firstOptionValue);
							config.selectedCoverTypeId = firstOptionValue;
						} else if (!defaultSelected && this.coverTypes.length === 0) {
							// This case should ideally not be hit if the outer if (this.coverTypes.length > 0) is structured well
							// but as a fallback:
							config.selectedCoverTypeId = "";
						}
						
					} else { // No cover types available
						console.warn(`No cover types loaded to populate filter for ${type}.`);
						$filterSelect.append(new Option(`No types available`, ""));
						$filterSelect.prop('disabled', true);
						config.selectedCoverTypeId = "";
					}
					this.initializeCoverTypeFilterListener(type);
				} else {
					console.warn(`Cover type filter select not found for ${type}: ${config.coverTypeFilterSelector}`);
				}
			}
			
			this.filterItems(type); // Apply initial filter based on selectedCoverTypeId
			this.displayMoreItems(type, true); // Display items based on the initial filter
			
			if (config.searchSelector) {
				this.initializeSearchListener(type);
			}
			this.initializeScrollListener(type);
		} catch (error) {
			console.error(`Error loading or parsing ${type} data:`, error);
			$list.html(`<p class="text-danger p-2">Error loading ${type}.</p>`);
		}
	}
	
	
	initializeCoverTypeFilterListener(type) {
		const config = this.itemTypesConfig[type];
		if (!config || !config.coverTypeFilterSelector) return;
		const $filterSelect = $(config.coverTypeFilterSelector);
		if (!$filterSelect.length) return;
		
		$filterSelect.off('change.typefilter').on('change.typefilter', () => {
			config.selectedCoverTypeId = $filterSelect.val();
			this.filterItems(type);
			this.displayMoreItems(type, true); // Reset and display new filtered items
		});
	}
	
	filterItems(type) {
		const config = this.itemTypesConfig[type];
		if (!config) return;
		
		let tempFilteredData = [...config.allData];
		
		// Filter by cover type ID if applicable and selected
		if (config.selectedCoverTypeId && config.selectedCoverTypeId !== "" && (type === 'covers' || type === 'templates')) {
			const selectedId = parseInt(config.selectedCoverTypeId, 10);
			if (!isNaN(selectedId)) { // Ensure selectedId is a valid number
				tempFilteredData = tempFilteredData.filter(item => item.coverTypeId === selectedId);
			}
		}
		
		// Filter by search term
		if (config.searchTerm && config.filterFn) {
			const term = config.searchTerm; // searchTerm is already lowercased by search listener
			tempFilteredData = tempFilteredData.filter(item => config.filterFn(item, term));
		}
		config.filteredData = tempFilteredData;
	}
	
	displayMoreItems(type, reset = false) {
		const config = this.itemTypesConfig[type];
		if (!config) return;
		if (config.isLoading && !reset) return;
		
		config.isLoading = true;
		const $list = $(config.listSelector);
		const $scrollArea = $list.closest('.panel-scrollable-content');
		
		if (reset) {
			$list.empty();
			config.currentlyDisplayed = 0;
			if ($scrollArea.length) {
				$scrollArea.scrollTop(0);
			}
		}
		
		const itemsToRender = config.filteredData.slice(
			config.currentlyDisplayed,
			config.currentlyDisplayed + config.itemsToShow
		);
		
		if (itemsToRender.length === 0) {
			if (config.currentlyDisplayed === 0) { // Only show "no items" if list is truly empty after filtering
				let message = `No ${type} found.`;
				if (config.searchTerm || (config.selectedCoverTypeId && config.selectedCoverTypeId !== "")) {
					message = `No ${type} match your criteria.`;
				}
				$list.html(`<p class="text-muted p-2">${message}</p>`);
			}
			config.isLoading = false;
			return;
		}
		
		const $newThumbs = $();
		const self = this;
		itemsToRender.forEach(itemData => {
			const $thumb = $(config.createThumbnail(itemData));
			$thumb.data('itemData', itemData);
			$thumb.on('click', function () {
				const clickedItemData = $(this).data('itemData');
				if (config.handleClick) {
					config.handleClick(clickedItemData, self);
				}
			});
			$newThumbs.push($thumb[0]);
		});
		
		$list.append($newThumbs);
		this._setupImageLoading($newThumbs);
		
		config.currentlyDisplayed += itemsToRender.length;
		setTimeout(() => {
			config.isLoading = false;
		}, 100);
	}
	
	initializeSearchListener(type) {
		const config = this.itemTypesConfig[type];
		if (!config || !config.searchSelector) return;
		const $search = $(config.searchSelector);
		if (!$search.length) {
			console.warn(`Search input not found for type "${type}": ${config.searchSelector}`);
			return;
		}
		
		$search.off('input.searchfilter').on('input.searchfilter', () => {
			clearTimeout(config.searchTimeout);
			config.searchTimeout = setTimeout(() => {
				config.searchTerm = $search.val().toLowerCase().trim();
				this.filterItems(type);
				this.displayMoreItems(type, true);
			}, config.searchDelay);
		});
	}
	
	initializeScrollListener(type) {
		const config = this.itemTypesConfig[type];
		if (!config || !config.scrollAreaSelector) return;
		const $scrollArea = $(config.scrollAreaSelector);
		if (!$scrollArea.length) {
			console.error(`Scroll area not found for type "${type}": ${config.scrollAreaSelector}`);
			return;
		}
		const self = this;
		$scrollArea.off(`scroll.${type}Loader`).on(`scroll.${type}Loader`, function () {
			const scrolledElement = this;
			const threshold = 200;
			if (config.isLoading) return;
			
			if (scrolledElement.scrollTop + scrolledElement.clientHeight >= scrolledElement.scrollHeight - threshold) {
				if (config.currentlyDisplayed < config.filteredData.length) {
					self.displayMoreItems(type);
				}
			}
		});
	}
	
	_setupImageLoading($thumbnails) {
		$thumbnails.each(function () {
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
				// Double check after attaching listeners, in case it loaded between .complete check and listener attachment
				if (img.complete) {
					onImageLoad();
					$img.off('load', onImageLoad); // Clean up listeners
					$img.off('error', onImageError);
				}
			}
		});
	}
	
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
			if (this.uploadedFile && self.addLayer && self.canvasManager && self.layerManager && self.showLoadingOverlay && self.hideLoadingOverlay) {
				console.log("Add Uploaded Image clicked");
				self.showLoadingOverlay("Adding uploaded image...");
				const reader = new FileReader();
				reader.onload = (e) => {
					const img = new Image();
					img.onload = () => {
						try {
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
								layerSubType: 'upload',
								name: `Upload ${self.layerManager.uniqueIdCounter}`
							});
							if (newLayer) {
								self.layerManager.selectLayer(newLayer.id);
								self.saveState();
							}
						} catch (error) {
							console.error("Error processing uploaded image for canvas:", error);
							alert("Error adding uploaded image. Please try again.");
						} finally {
							self.hideLoadingOverlay();
						}
					};
					img.onerror = () => {
						console.error("Failed to load uploaded image data for adding to canvas.");
						alert("Failed to load uploaded image. Please check the image or try again.");
						self.hideLoadingOverlay();
					};
					img.src = e.target.result;
				}
				reader.onerror = () => {
					console.error("FileReader error while reading uploaded file.");
					alert("Error reading uploaded file. Please try again.");
					self.hideLoadingOverlay();
				};
				reader.readAsDataURL(this.uploadedFile);
			} else {
				console.error("Missing uploadedFile, addLayer, canvasManager, or layerManager for upload button click.");
			}
		});
	}
}
