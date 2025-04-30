class SidebarItemManager {
	constructor(options) {
		// Selectors from options
		this.$layoutList = $(options.layoutListSelector);
		this.$coverList = $(options.coverListSelector);
		this.$coverSearch = $(options.coverSearchSelector);
		this.$elementList = $(options.elementListSelector);
		this.$uploadPreview = $(options.uploadPreviewSelector);
		this.$uploadInput = $(options.uploadInputSelector);
		this.$addImageBtn = $(options.addImageBtnSelector);
		
		// Data URLs from options
		this.layoutsUrl = options.layoutsUrl;
		this.coversUrl = options.coversUrl;
		this.elementsUrl = options.elementsUrl;
		
		// Callbacks
		this.addLayer = options.addLayer; // Function to add layer to canvas
		this.saveState = options.saveState;
		
		this.uploadedFile = null;
		this.allCoversData = []; // Store all covers for filtering
	}
	
	loadAll() {
		this.loadLayouts();
		this.loadCovers();
		this.loadElements();
		this.initializeUpload();
	}
	
	// --- Layouts ---
	loadLayouts() {
		$.getJSON(this.layoutsUrl)
			.done(data => {
				this.$layoutList.empty();
				data.forEach(layout => {
					const $thumb = $(`
                        <div class="item-thumbnail layout-thumbnail" title="${layout.name}">
                            <img src="${layout.thumbnail || 'img/placeholder_layout.png'}" alt="${layout.name}">
                            <span>${layout.name}</span>
                        </div>
                    `);
					$thumb.data('layoutData', layout.layers); // Store layer data
					this.$layoutList.append($thumb);
				});
				this._makeDraggable(this.$layoutList.find('.layout-thumbnail'), { width: '100px', height: 'auto' });
			})
			.fail(() => this.$layoutList.html('<p class="text-danger">Error loading layouts.</p>'));
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
			appendTo: 'body',
			zIndex: 1100,
			revert: 'invalid',
			start: function(event, ui) {
				$(ui.helper).css({'width': helperSize.width, 'height': helperSize.height, 'opacity': 0.7});
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
					this.$uploadPreview.html(`<img src="${e.target.result}" alt="Upload Preview" style="max-width: 100%; max-height: 150px;">`);
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
					this.addLayer('image', {
						content: e.target.result, // Base64 data URL
						x: 20, y: 20,
						width: 200, height: 'auto'
					});
					this.saveState(); // Save state after adding uploaded image
					
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
