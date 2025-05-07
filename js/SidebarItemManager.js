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
		
		// Configuration for different item types
		this.itemTypesConfig = {
			templates: {
				type: 'templates',
				dataElementId: 'templateData',
				listSelector: '#templateList',
				searchSelector: '#templateSearch',
				coverTypeFilterSelector: '#templateTypeFilter', // New
				selectedCoverTypeId: '', // New - stores the ID as a string
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
				coverTypeFilterSelector: '#coverTypeFilter', // New
				selectedCoverTypeId: '', // New - stores the ID as a string
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
									x: 0, y: 0,
									width: canvasWidth, height: canvasHeight,
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
				// No coverTypeFilterSelector for elements
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
									content: imgSrc, x: finalX, y: finalY,
									width: elemWidth, height: elemHeight,
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
				// No coverTypeFilterSelector for overlays
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
					const imgSrc = itemData.imagePath;
					if (imgSrc && manager.addLayer && manager.canvasManager && manager.layerManager && manager.showLoadingOverlay && manager.hideLoadingOverlay) {
						console.log("Overlay clicked:", imgSrc);
						const existingLayers = manager.layerManager.getLayers();
						const existingOverlayIds = existingLayers
							.filter(layer => layer.type === 'image' && layer.layerSubType === 'overlay')
							.map(layer => layer.id);
						let deleteConfirmed = true;
						if (existingOverlayIds.length > 0) {
							deleteConfirmed = confirm("Remove existing overlay layer(s) before adding this one?");
							if (deleteConfirmed) {
								console.log(`Removing ${existingOverlayIds.length} existing overlay layers.`);
								existingOverlayIds.forEach(id => manager.layerManager.deleteLayer(id, false));
							} else {
								console.log("Keeping existing overlay layers.");
							}
						}
						manager.showLoadingOverlay("Adding overlay...");
						const img = new Image();
						img.onload = () => {
							try {
								const canvasWidth = manager.canvasManager.currentCanvasWidth;
								const canvasHeight = manager.canvasManager.currentCanvasHeight;
								const imgWidth = img.width;
								const imgHeight = img.height;
								const finalX = (canvasWidth - imgWidth) / 2;
								const finalY = (canvasHeight - imgHeight) / 2;
								const newLayer = manager.addLayer('image', {
									content: imgSrc, x: finalX, y: finalY,
									width: imgWidth, height: imgHeight,
									blendMode: 'overlay',
									layerSubType: 'overlay',
									name: `Overlay ${manager.layerManager.uniqueIdCounter}`
								});
								if (newLayer) {
									const allLayers = manager.layerManager.getLayers();
									const coverLayers = allLayers.filter(l => l.type === 'image' && l.layerSubType === 'cover');
									const coverZIndex = coverLayers.length > 0 ? Math.max(...coverLayers.map(l => l.zIndex || 0)) : 0;
									const targetZIndex = coverZIndex + 1;
									console.log(`Positioning new overlay ${newLayer.id} at zIndex ${targetZIndex}`);
									const addedLayerInData = manager.layerManager.layers.find(l => l.id === newLayer.id);
									if (addedLayerInData) {
										manager.layerManager.layers.forEach(layer => {
											if (layer.zIndex >= targetZIndex && layer.id !== newLayer.id) {
												layer.zIndex++;
											}
										});
										addedLayerInData.zIndex = targetZIndex;
									} else {
										console.error("Could not find newly added layer in internal array for zIndex update.");
									}
									manager.layerManager._updateZIndices();
									manager.layerManager.updateList();
									manager.layerManager.selectLayer(newLayer.id);
									manager.saveState();
									this.closeSidebarPanel();
								}
							} catch (error) {
								console.error("Error processing overlay image:", error);
								alert("Error adding overlay. Please try again.");
							} finally {
								manager.hideLoadingOverlay();
							}
						};
						img.onerror = () => {
							console.error("Failed to load overlay image for clicking:", imgSrc);
							alert("Failed to load overlay image. Please check the image path or try again.");
							manager.hideLoadingOverlay();
						};
						img.src = imgSrc;
					} else {
						console.error("Missing imgSrc, addLayer, canvasManager, or layerManager for overlay click.");
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
			this.coverTypes = []; // Ensure it's an array on error
		}
		
		Object.keys(this.itemTypesConfig).forEach(type => {
			this.loadItems(type);
		});
		this.initializeUpload();
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
			config.filteredData = config.allData;
			
			if (config.allData.length === 0) {
				$list.html(`<p class="text-muted p-2">No ${type} found.</p>`);
				// Still proceed to set up filters if they exist, even with no data initially
			}
			
			// Populate cover type filter if applicable for this item type
			if (config.coverTypeFilterSelector && (type === 'covers' || type === 'templates')) {
				const $filterSelect = $(config.coverTypeFilterSelector);
				if ($filterSelect.length) {
					if (this.coverTypes.length > 0) {
						// Clear existing options except the first "All Types"
						$filterSelect.find('option:not(:first-child)').remove();
						this.coverTypes.forEach(coverType => {
							// coverType.id is from DB (int), coverType.type_name is string
							$filterSelect.append(new Option(coverType.type_name, coverType.id.toString()));
						});
					} else {
						console.warn(`No cover types loaded to populate filter for ${type}.`);
					}
					this.initializeCoverTypeFilterListener(type); // Initialize listener
				} else {
					console.warn(`Cover type filter select not found for ${type}: ${config.coverTypeFilterSelector}`);
				}
			}
			
			// if (config.gridColumns) {
			// 	$list.css('grid-template-columns', `repeat(${config.gridColumns}, 1fr)`);
			// }
			this.displayMoreItems(type, true); // Initial display
			
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
		if (!$filterSelect.length) {
			// Warning already issued in loadItems
			return;
		}
		
		// Remove previous listener to avoid duplicates if re-initialized
		$filterSelect.off('change.typefilter').on('change.typefilter', () => {
			config.selectedCoverTypeId = $filterSelect.val(); // Value is string (e.g., "1", "2", or "")
			//console.log(`Selected cover type ID for ${type}: ${config.selectedCoverTypeId}`);
			this.filterItems(type);
			this.displayMoreItems(type, true); // Reset display on new filter
		});
	}
	
	
	filterItems(type) {
		const config = this.itemTypesConfig[type];
		if (!config) return;
		
		let tempFilteredData = [...config.allData]; // Start with a copy of all data
		
		// 1. Filter by Cover Type (if applicable and a type ID is selected)
		// config.selectedCoverTypeId is a string from the select value ("" for "All Types")
		if (config.selectedCoverTypeId && config.selectedCoverTypeId !== "" && (type === 'covers' || type === 'templates')) {
			const selectedId = parseInt(config.selectedCoverTypeId, 10);
			console.log(tempFilteredData);
			tempFilteredData = tempFilteredData.filter(item => item.coverTypeId === selectedId);
		}
		
		// 2. Filter by Search Term (if applicable and a term exists)
		if (config.searchTerm && config.filterFn) {
			const term = config.searchTerm.toLowerCase();
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
			if (config.currentlyDisplayed === 0) { // Only show message if list is empty after filtering
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
		
		// Remove previous listener to avoid duplicates
		$search.off('input.searchfilter').on('input.searchfilter', () => {
			clearTimeout(config.searchTimeout);
			config.searchTimeout = setTimeout(() => {
				config.searchTerm = $search.val().toLowerCase().trim();
				this.filterItems(type);
				this.displayMoreItems(type, true); // Reset display on new search
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
			if (config.isLoading) {
				return;
			}
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
				if (img.complete) { // Double check after attaching
					onImageLoad();
					$img.off('load', onImageLoad);
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
								x: layerX, y: layerY,
								width: layerWidth, height: layerHeight,
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
