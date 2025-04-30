class SidebarItemManager {
	constructor(options) {
		// Selectors from options
		this.$templateList = $(options.templateListSelector); // Changed selector name
		this.$coverList = $(options.coverListSelector);
		this.$coverSearch = $(options.coverSearchSelector);
		this.$elementList = $(options.elementListSelector);
		this.$uploadPreview = $(options.uploadPreviewSelector);
		this.$uploadInput = $(options.uploadInputSelector);
		this.$addImageBtn = $(options.addImageBtnSelector);
		
		// Data URLs from options (Covers and Elements remain)
		// this.layoutsUrl = options.layoutsUrl; // Removed
		this.coversUrl = options.coversUrl;
		this.elementsUrl = options.elementsUrl;
		
		// Callbacks
		this.applyTemplate = options.applyTemplate; // New callback for applying template
		this.addLayer = options.addLayer; // Function to add layer to canvas (for uploads/elements)
		this.saveState = options.saveState;
		
		this.uploadedFile = null;
		this.allCoversData = []; // Store all covers for filtering
	}
	
	loadAll() {
		this.loadTemplates(); // Changed method name
		this.loadCovers();
		this.loadElements();
		this.initializeUpload();
	}
	
	// --- Templates (Previously Layouts) ---
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
				$thumb.data('templateJsonPath', template.jsonPath); // Store path to JSON
				this.$templateList.append($thumb);
			});
			
			// Make draggable - Dropping handled by CanvasManager
			this._makeDraggable(this.$templateList.find('.template-thumbnail'), { width: '100px', height: 'auto' });
			
			// Optional: Add click handler to apply template directly
			this.$templateList.find('.template-thumbnail').on('click', (e) => {
				const jsonPath = $(e.currentTarget).data('templateJsonPath');
				if (jsonPath) {
					this.applyTemplate(jsonPath, true); // Use the callback
				}
			});
			
		} catch (error) {
			console.error("Error loading templates:", error);
			this.$templateList.html('<p class="text-danger">Error loading templates.</p>');
		}
	}
	
	// --- Covers ---
	loadCovers() {
		$.getJSON(this.coversUrl)
			.done(data => {
				this.allCoversData = data; // Store for searching
				this.renderCovers(this.allCoversData); // Initial render
				// Search functionality
				this.$coverSearch.on('input', () => {
					const searchTerm = this.$coverSearch.val().toLowerCase();
					const filteredData = this.allCoversData.filter(cover =>
						cover.title.toLowerCase().includes(searchTerm) ||
						(cover.keywords && cover.keywords.some(k => k.toLowerCase().includes(searchTerm)))
					);
					this.renderCovers(filteredData);
				});
			})
			.fail(() => this.$coverList.html('<p class="text-danger">Error loading covers.</p>'));
	}
	
	renderCovers(coverData) {
		this.$coverList.empty();
		if (coverData.length === 0) {
			this.$coverList.html('<p class="text-muted">No covers found.</p>');
			return;
		}
		coverData.forEach(cover => {
			const $thumb = $(`
                <div class="item-thumbnail cover-thumbnail" title="${cover.title}">
                    <img src="${cover.image}" alt="${cover.title}">
                    <span>${cover.title}</span>
                </div>
            `);
			$thumb.data('coverSrc', cover.image);
			this.$coverList.append($thumb);
		});
		this._makeDraggable(this.$coverList.find('.cover-thumbnail'), { width: '80px', height: 'auto' });
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
				this._makeDraggable(this.$elementList.find('.element-thumbnail'), { width: '50px', height: '50px' });
			})
			.fail(() => this.$elementList.html('<p class="text-danger">Error loading elements.</p>'));
	}
	
	// --- Draggable Helper ---
	_makeDraggable($items, helperSize) {
		$items.draggable({
			helper: 'clone',
			appendTo: 'body', // Append to body to avoid sidebar scroll issues
			zIndex: 1100,
			revert: 'invalid',
			cursor: 'grabbing',
			start: function(event, ui) {
				$(ui.helper).css({
					'width': helperSize.width,
					'height': helperSize.height,
					'opacity': 0.7,
					'background': '#fff', // Add background for visibility
					'border': '1px dashed #ccc',
					'padding': '5px',
					'text-align': 'center'
				}).find('span').css({'font-size': '0.7rem'});
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
					this.$uploadPreview.html(`<img src="${e.target.result}" alt="Upload Preview" style="max-width: 100%; max-height: 150px; object-fit: contain;">`); // Added object-fit
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
					// Use the callback to add the layer
					const img = new Image();
					img.onload = () => {
						// Add layer with initial size based on image, capped
						const MAX_WIDTH = this.$templateList.width() * 0.8; // Example max width
						this.addLayer('image', {
							content: e.target.result, // Base64 data URL
							x: 20,
							y: 20,
							width: img.width,
							height: img.height
						});
						this.saveState(); // Save state after adding uploaded image
					};
					img.src = e.target.result;
					
					// Optionally clear preview after adding
					// this.uploadedFile = null;
					// this.$uploadPreview.empty();
					// this.$uploadInput.val('');
					// this.$addImageBtn.prop('disabled', true);
				}
				reader.readAsDataURL(this.uploadedFile);
			}
		});
	}
}
