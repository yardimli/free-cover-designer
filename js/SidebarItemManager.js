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
		
		// Callbacks
		this.applyTemplate = options.applyTemplate;
		this.addLayer = options.addLayer;
		this.saveState = options.saveState;
		
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
	
	// --- Templates --- (Keep existing method)
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
			templates.forEach(template => {
				// Add loading class and spinner overlay div
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
				$newThumbs.push($thumb[0]);
			});
			
			this.$templateList.append($newThumbs);
			this._makeDraggable($newThumbs, { type: 'template' });
			this._setupImageLoading($newThumbs); // Setup loading state
			
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
			
			// Debounced Search Listener
			this.$coverSearch.on('input', () => {
				clearTimeout(this.searchTimeout);
				this.searchTimeout = setTimeout(() => {
					this.currentSearchTerm = this.$coverSearch.val().toLowerCase().trim();
					this.filterCovers();
					this.displayMoreCovers(true); // Reset and display filtered
				}, this.searchDelay);
			});
			
			// Infinite Scroll Listener
			this.$sidebarContent.on('scroll', () => {
				if ($('#coversPanel').hasClass('show') && !this.isLoadingCovers) { // Use isLoadingCovers for scroll throttling
					const container = this.$sidebarContent[0];
					const threshold = 200;
					if (container.scrollTop + container.clientHeight >= container.scrollHeight - threshold) {
						if (this.currentlyDisplayedCovers < this.filteredCoversData.length) {
							this.displayMoreCovers(); // Load next batch
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
		// Use isLoadingCovers to prevent multiple scroll triggers firing this
		if (this.isLoadingCovers && !reset) return;
		this.isLoadingCovers = true;
		
		// REMOVE old spinner logic
		// this.removeSpinner();
		
		if (reset) {
			this.$coverList.empty();
			this.currentlyDisplayedCovers = 0;
		}
		
		const coversToRender = this.filteredCoversData.slice(
			this.currentlyDisplayedCovers,
			this.currentlyDisplayedCovers + this.coversToShow
		);
		
		// Handle no results message *only on reset*
		if (coversToRender.length === 0 && reset) {
			if (this.currentSearchTerm) {
				this.$coverList.html('<p class="text-muted p-2">No covers match your search.</p>');
			} else if (this.allCoversData.length === 0) {
				this.$coverList.html('<p class="text-muted p-2">No covers found.</p>');
			}
			// If not reset and no covers, we just reached the end of infinite scroll.
			this.isLoadingCovers = false; // Reset flag
			return;
		}
		// If no covers left to render in this batch (scrolled to end)
		if (coversToRender.length === 0 && !reset) {
			this.isLoadingCovers = false; // Reset flag
			return;
		}
		
		
		const $newThumbs = $(); // Create an empty jQuery object
		
		coversToRender.forEach(cover => {
			const title = cover.caption ? `${cover.name} - ${cover.caption}` : cover.name;
			// Add loading class and spinner overlay div
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
			$newThumbs.push($thumb[0]);
		});
		
		this.$coverList.append($newThumbs);
		this._makeDraggable($newThumbs, { type: 'cover' });
		this._setupImageLoading($newThumbs); // Setup loading state for new images
		
		this.currentlyDisplayedCovers += coversToRender.length;
		
		// Reset flag slightly later to allow DOM updates and prevent rapid re-trigger
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
				$thumb.removeClass('loading').addClass('loaded'); // No image, treat as loaded
				$spinnerOverlay.hide();
				return;
			}
			
			const img = $img[0];
			
			const onImageLoad = () => {
				$spinnerOverlay.hide(); // Hide spinner
				$thumb.removeClass('loading').addClass('loaded'); // Add loaded class (triggers img opacity)
			};
			
			const onImageError = () => {
				console.error("Failed to load image:", img.src);
				$spinnerOverlay.html('<i class="fas fa-exclamation-triangle text-danger"></i>'); // Show error icon
				// Keep overlay visible with error icon
				$thumb.removeClass('loading').addClass('error'); // Add error class
			}
			
			// Check if image is already loaded (e.g., from cache)
			if (img.complete) {
				onImageLoad();
			} else {
				$img.on('load', onImageLoad);
				$img.on('error', onImageError);
				// Double-check completion state after attaching listeners,
				// in case it loaded between the check and listener attachment.
				if (img.complete) {
					onImageLoad();
					$img.off('load', onImageLoad); // Remove listener if already complete
					$img.off('error', onImageError);
				}
			}
		});
	}
	

	// --- Elements --- (Keep existing method)
	loadElements() {
		try {
			// Read data embedded by PHP
			const elementDataElement = document.getElementById('elementData');
			const elements = JSON.parse(elementDataElement.textContent || '[]');
			
			this.$elementList.empty();
			if (elements.length === 0) {
				this.$elementList.html('<p class="text-muted p-2">No elements found.</p>');
				return;
			}
			
			const $newThumbs = $();
			elements.forEach(element => {
				// Add loading class and spinner overlay div
				// REMOVED the <span> element
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
				$thumb.data('elementSrc', element.image); // Store the path to the actual image
				$newThumbs.push($thumb[0]);
			});
			
			this.$elementList.append($newThumbs);
			this._makeDraggable($newThumbs, { type: 'element' });
			this._setupImageLoading($newThumbs); // Setup loading state
			
		} catch (error) {
			console.error("Error loading elements:", error);
			this.$elementList.html('<p class="text-danger p-2">Error loading elements.</p>');
		}
	}
	
	// --- Draggable Helper --- (Keep existing method)
	_makeDraggable($items, options) {
		// options might contain type or other info if needed later
		$items.draggable({
			helper: 'clone',
			appendTo: 'body',
			zIndex: 1100,
			revert: 'invalid',
			cursor: 'grabbing',
			start: function(event, ui) {
				const $helper = $(ui.helper);
				const $img = $helper.find('img');
				const imgElement = $img[0]; // Get the raw DOM element
				
				let targetWidth = 100; // Default width if natural dimensions fail
				let targetHeight = 'auto'; // Default height
				const maxWidth = 150; // Max width for helper clone
				
				// Use naturalWidth/Height if available (best for aspect ratio)
				if (imgElement && imgElement.naturalWidth && imgElement.naturalWidth > 0) {
					const naturalWidth = imgElement.naturalWidth;
					const naturalHeight = imgElement.naturalHeight;
					const aspectRatio = naturalHeight / naturalWidth;
					
					if (naturalWidth > maxWidth) {
						targetWidth = maxWidth;
						targetHeight = targetWidth * aspectRatio;
					} else {
						// Use natural size if it's smaller than maxWidth
						targetWidth = naturalWidth;
						targetHeight = naturalHeight;
					}
				} else if ($img.width() > 0) {
					// Fallback to rendered dimensions if natural dimensions aren't ready/available
					// console.warn("Using rendered dimensions for draggable helper, aspect ratio might be slightly off if image wasn't fully loaded.");
					const currentWidth = $img.width();
					const currentHeight = $img.height();
					if (currentWidth > 0) { // Ensure width is not zero
						const aspectRatio = currentHeight / currentWidth;
						if (currentWidth > maxWidth) {
							targetWidth = maxWidth;
							targetHeight = targetWidth * aspectRatio;
						} else {
							targetWidth = currentWidth;
							targetHeight = currentHeight;
						}
					}
				}
				// If both fail, the default 100/auto is used.
				
				// Apply styles to the helper container
				$helper.css({
					'width': targetWidth + 'px',
					'height': targetHeight === 'auto' ? 'auto' : targetHeight + 'px',
					'opacity': 0.9, // Slightly increased opacity
					'background': '#fff',
					'border': '1px dashed #aaa', // Slightly darker border
					'padding': '5px',
					'text-align': 'center',
					'overflow': 'hidden' // Prevent content spill
				});
				
				// Style the image within the helper to fit nicely
				$img.css({
					'display': 'block', // Remove potential extra space below image
					'max-width': '100%',
					'max-height': '100%', // Ensure it doesn't exceed helper bounds
					'width': 'auto', // Let dimensions scale based on container
					'height': 'auto', // Let dimensions scale based on container
					'object-fit': 'contain', // Ensure entire image is visible within bounds
					'margin': '0 auto' // Center the image horizontally
				});
				
				// Style the text
				$helper.find('span').css({
					'display': 'block', // Ensure it takes its own line
					'font-size': '0.7rem',
					'white-space': 'nowrap', // Prevent wrapping
					'overflow': 'hidden', // Hide overflow
					'text-overflow': 'ellipsis', // Add ellipsis if text is too long
					'margin-top': '3px' // Add a little space above text
				});
			}
		});
	}
	
	// --- Upload --- (Keep existing method)
	initializeUpload() {
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
			if (this.uploadedFile) {
				const reader = new FileReader();
				reader.onload = (e) => {
					const img = new Image();
					img.onload = () => {
						// Add layer centered or at a default position
						const canvasWidth = $('#canvas').width();
						const canvasHeight = $('#canvas').height();
						const layerWidth = Math.min(img.width, canvasWidth * 0.8); // Scale down if too large
						const aspectRatio = img.height / img.width;
						const layerHeight = layerWidth * aspectRatio;
						const layerX = Math.max(0, (canvasWidth - layerWidth) / 2);
						const layerY = Math.max(0, (canvasHeight - layerHeight) / 2);
						
						this.addLayer('image', {
							content: e.target.result,
							x: layerX,
							y: layerY,
							width: layerWidth,
							height: layerHeight,
							layerSubType: 'upload'
						});
						this.saveState();
					};
					img.src = e.target.result;
				}
				reader.readAsDataURL(this.uploadedFile);
			}
		});
	}
}
