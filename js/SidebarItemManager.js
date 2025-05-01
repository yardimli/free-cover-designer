class SidebarItemManager {
	constructor(options) {
		// Selectors from options
		this.$templateList = $(options.templateListSelector);
		this.$coverList = $(options.coverListSelector);
		this.$coverSearch = $(options.coverSearchSelector);
		this.$elementList = $(options.elementListSelector);
		this.$uploadPreview = $(options.uploadPreviewSelector);
		this.$uploadInput = $(options.uploadInputSelector);
		this.$addImageBtn = $(options.addImageBtnSelector);
		
		// Data URLs from options
		this.elementsUrl = options.elementsUrl;
		
		// Callbacks
		this.applyTemplate = options.applyTemplate;
		this.addLayer = options.addLayer;
		this.saveState = options.saveState;
		
		this.uploadedFile = null;
		this.allCoversData = []; // Store all covers for filtering
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
				this.$templateList.html('<p class="text-muted">No templates found.</p>');
				return;
			}
			templates.forEach(template => {
				const $thumb = $(`
                    <div class="item-thumbnail template-thumbnail" title="${template.name}">
                        <img src="${template.thumbnailPath}" alt="${template.name}">
                        <span>${template.name}</span>
                    </div>
                `);
				$thumb.data('templateJsonPath', template.jsonPath);
				this.$templateList.append($thumb);
			});
			// Pass a descriptive object, though it won't be directly used for sizing anymore
			this._makeDraggable(this.$templateList.find('.template-thumbnail'), { type: 'template' });
			this.$templateList.find('.template-thumbnail').on('click', (e) => {
				const jsonPath = $(e.currentTarget).data('templateJsonPath');
				if (jsonPath) {
					this.applyTemplate(jsonPath, true);
				}
			});
		} catch (error) {
			console.error("Error loading templates:", error);
			this.$templateList.html('<p class="text-danger">Error loading templates.</p>');
		}
	}
	
	// --- Covers ---
	loadCovers() {
		try {
			const coverDataElement = document.getElementById('coverData');
			const covers = JSON.parse(coverDataElement.textContent || '[]');
			this.allCoversData = covers;
			this.renderCovers(this.allCoversData);
			
			this.$coverSearch.on('input', () => {
				const searchTerm = this.$coverSearch.val().toLowerCase();
				const filteredData = this.allCoversData.filter(cover =>
					cover.name.toLowerCase().includes(searchTerm)
				);
				this.renderCovers(filteredData);
			});
			
		} catch (error) {
			console.error("Error loading covers:", error);
			this.$coverList.html('<p class="text-danger">Error loading covers.</p>');
		}
	}
	
	renderCovers(coverData) {
		this.$coverList.empty();
		if (coverData.length === 0) {
			this.$coverList.html('<p class="text-muted">No covers found.</p>');
			return;
		}
		coverData.forEach(cover => {
			const $thumb = $(`
                <div class="item-thumbnail cover-thumbnail" title="${cover.name}">
                    <img src="${cover.thumbnailPath}" alt="${cover.name}">
                    <span>${cover.name}</span>
                </div>
            `);
			$thumb.data('coverSrc', cover.imagePath);
			this.$coverList.append($thumb);
		});
		// Pass a descriptive object
		this._makeDraggable(this.$coverList.find('.cover-thumbnail'), { type: 'cover' });
	}
	
	// --- Elements ---
	loadElements() {
		$.getJSON(this.elementsUrl)
			.done(data => {
				this.$elementList.empty();
				data.forEach(element => {
					const $thumb = $(`
                        <div class="item-thumbnail element-thumbnail" title="${element.name}">
                            <img src="${element.image}" alt="${element.name}">
                            <span>${element.name}</span>
                        </div>
                    `);
					$thumb.data('elementSrc', element.image);
					this.$elementList.append($thumb);
				});
				// Pass a descriptive object
				this._makeDraggable(this.$elementList.find('.element-thumbnail'), { type: 'element' });
			})
			.fail(() => this.$elementList.html('<p class="text-danger">Error loading elements.</p>'));
	}
	
	// --- Draggable Helper ---
	_makeDraggable($items, options) { // options might contain type or other info if needed later
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
				const maxWidth = 300; // The desired maximum width
				
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
					console.warn("Using rendered dimensions for draggable helper, aspect ratio might be slightly off if image wasn't fully loaded.");
					const currentWidth = $img.width();
					const currentHeight = $img.height();
					const aspectRatio = currentHeight / currentWidth;
					
					if (currentWidth > maxWidth) {
						targetWidth = maxWidth;
						targetHeight = targetWidth * aspectRatio;
					} else {
						targetWidth = currentWidth;
						targetHeight = currentHeight;
					}
				}
				// If both fail, the default 100/auto is used.
				
				// Apply styles to the helper container
				$helper.css({
					'width': targetWidth + 'px',
					'height': targetHeight === 'auto' ? 'auto' : targetHeight + 'px',
					'opacity': 0.8, // Slightly increased opacity
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
					'width': 'auto',     // Let dimensions scale based on container
					'height': 'auto',    // Let dimensions scale based on container
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
	
	
	// --- Upload ---
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
						this.addLayer('image', {
							content: e.target.result,
							x: 20,
							y: 20,
							width: img.width,
							height: img.height
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
