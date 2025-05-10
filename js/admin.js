// free-cover-designer/js/admin.js
$(document).ready(function() {
	const API_URL = 'admin_actions.php';
	const ITEMS_PER_PAGE = 30; // Should match ADMIN_ITEMS_PER_PAGE in PHP config if possible
	let currentItemStates = {}; // Store page, search query, and cover type filter for each type
	let allCoverTypes = []; // Store fetched cover types
	
	// --- Utility Functions ---
	function showAlert(message, type = 'success') {
		const alertId = 'alert-' + Date.now();
		const alertHtml = `
            <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>`;
		$('#alert-messages-container').append(alertHtml);
		setTimeout(() => {
			$('#' + alertId).fadeOut(500, function() { $(this).remove(); });
		}, 5000);
	}
	
	function escapeHtml(unsafe) {
		if (unsafe === null || typeof unsafe === 'undefined') return '';
		return String(unsafe)
			.replace(/&/g, "&")
			.replace(/</g, "<")
			.replace(/>/g, ">")
			.replace(/"/g, "\"")
			.replace(/'/g, "'");
	}
	
	function capitalizeFirstLetter(string) {
		return string.charAt(0).toUpperCase() + string.slice(1);
	}
	
	function deriveNameFromFilename(filename) {
		let name = filename;
		const lastDot = filename.lastIndexOf('.');
		if (lastDot > 0) {
			name = filename.substring(0, lastDot);
		}
		name = name.replace(/[-_]/g, ' ');
		name = name.replace(/\s+/g, ' ').trim();
		return capitalizeFirstLetter(name);
	}
	
	function renderKeywords(keywords) {
		if (!keywords || !Array.isArray(keywords) || keywords.length === 0) return '';
		const escapedKeywords = keywords.map(k => typeof k === 'string' ? escapeHtml(k.trim()) : '');
		return `<div class="keywords-list">${escapedKeywords.filter(k => k).map(k => `<span>${k}</span>`).join('')}</div>`;
	}
	
	// --- Cover Type Functions ---
	function fetchCoverTypes() {
		return $.ajax({ // Return the promise
			url: API_URL,
			type: 'GET',
			data: { action: 'list_cover_types' },
			dataType: 'json',
			success: function(response) {
				if (response.success && response.data.cover_types) {
					allCoverTypes = response.data.cover_types;
					populateAllCoverTypeDropdowns();
				} else {
					showAlert('Error fetching cover types: ' + escapeHtml(response.message), 'danger');
				}
			},
			error: function(xhr, status, error) {
				showAlert('Failed to connect to server to fetch cover types: ' + escapeHtml(xhr.responseText || error), 'danger');
			}
		});
	}
	
	function populateAllCoverTypeDropdowns() {
		$('.admin-cover-type-dropdown').each(function() {
			const $dropdown = $(this);
			const isFilterDropdown = $dropdown.hasClass('cover-type-filter');
			const firstOptionValue = $dropdown.find('option:first-child').val();
			const firstOptionText = $dropdown.find('option:first-child').text();
			
			$dropdown.empty(); // Clear all options
			$dropdown.append(`<option value="${firstOptionValue}">${firstOptionText}</option>`); // Add back the placeholder
			
			allCoverTypes.forEach(function(type) {
				$dropdown.append(`<option value="${escapeHtml(type.id)}">${escapeHtml(type.type_name)}</option>`);
			});
		});
	}
	
	
	// --- State Management ---
	function getCurrentState(itemType) {
		return currentItemStates[itemType] || { page: 1, search: '', coverTypeId: '' };
	}
	
	function setCurrentState(itemType, page, search, coverTypeId) {
		currentItemStates[itemType] = { page, search, coverTypeId };
	}
	
	// --- Loading and Rendering Items ---
	function loadItems(itemType, page = 1, searchQuery = '', coverTypeIdFilter = '') {
		const $tableBody = $(`#${itemType}Table tbody`);
		const $paginationContainer = $(`#${itemType}Pagination`);
		$tableBody.html('<tr><td colspan="100%" class="text-center"><span class="spinner-border spinner-border-sm"></span> Loading...</td></tr>');
		$paginationContainer.empty();
		setCurrentState(itemType, page, searchQuery, coverTypeIdFilter);
		
		let ajaxData = {
			action: 'list_items',
			type: itemType,
			page: page,
			limit: ITEMS_PER_PAGE,
			search: searchQuery
		};
		
		if (coverTypeIdFilter && (itemType === 'covers' || itemType === 'templates')) {
			ajaxData.cover_type_id = coverTypeIdFilter;
		}
		
		$.ajax({
			url: API_URL,
			type: 'GET',
			data: ajaxData,
			dataType: 'json',
			success: function(response) {
				if (response.success) {
					$tableBody.empty();
					const items = response.data.items;
					const pagination = response.data.pagination;
					
					if (items.length === 0) {
						let message = `No ${itemType} found.`;
						if (searchQuery) message = `No ${itemType} found matching "${escapeHtml(searchQuery)}".`;
						if (coverTypeIdFilter) message += ` for the selected cover type.`;
						$tableBody.html(`<tr><td colspan="100%" class="text-center">${message}</td></tr>`);
					} else {
						items.forEach(item => {
							let rowHtml = `<tr>`;
							const thumbUrl = item.thumbnail_url || 'images/placeholder.png';
							const isSquareThumb = itemType === 'elements' || itemType === 'overlays';
							rowHtml += `<td><img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(item.name)}" class="thumbnail-preview ${isSquareThumb ? 'square' : ''}" loading="lazy"></td>`;
							rowHtml += `<td>${escapeHtml(item.name)}</td>`;
							
							if (itemType === 'covers') {
								rowHtml += `<td>${escapeHtml(item.cover_type_name || 'N/A')}</td>`;
								rowHtml += `<td>${escapeHtml(item.caption || '')}</td>`;
								rowHtml += `<td>${renderKeywords(item.keywords)}</td>`;
								rowHtml += `<td>${renderKeywords(item.categories)}</td>`;
							} else if (itemType === 'templates') {
								rowHtml += `<td>${escapeHtml(item.cover_type_name || 'N/A')}</td>`;
								rowHtml += `<td>${renderKeywords(item.keywords)}</td>`;
							} else if (itemType === 'elements' || itemType === 'overlays') {
								rowHtml += `<td>${renderKeywords(item.keywords)}</td>`;
							}
							
							// Action Buttons
							rowHtml += `<td>`;
							if (itemType === 'templates') {
								rowHtml += `
                                    <button class="btn btn-success btn-sm me-1 generate-similar-template" data-id="${item.id}" data-type="${itemType}" title="Generate Similar with AI">
                                        <i class="fas fa-robot"></i>
                                    </button>`;
							}
							rowHtml += `
                                <button class="btn btn-info btn-sm me-1 generate-ai-metadata" data-id="${item.id}" data-type="${itemType}" title="Generate AI Metadata">
                                    <i class="fas fa-wand-magic-sparkles"></i>
                                </button>
                                <button class="btn btn-warning btn-sm me-1 edit-item" data-id="${item.id}" data-type="${itemType}" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-danger btn-sm delete-item" data-id="${item.id}" data-type="${itemType}" title="Delete">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </td>`;
							rowHtml += `</tr>`;
							$tableBody.append(rowHtml);
						});
					}
					renderPagination(itemType, pagination);
				} else {
					$tableBody.html(`<tr><td colspan="100%" class="text-center text-danger">Error loading ${itemType}: ${escapeHtml(response.message)}</td></tr>`);
					showAlert(`Error loading ${itemType}: ${escapeHtml(response.message)}`, 'danger');
				}
			},
			error: function(xhr, status, error) {
				$tableBody.html(`<tr><td colspan="100%" class="text-center text-danger">AJAX Error loading ${itemType}. Check console.</td></tr>`);
				showAlert(`AJAX Error loading ${itemType}: ${escapeHtml(xhr.responseText || error)}`, 'danger');
				console.error("AJAX Error:", status, error, xhr.responseText);
			}
		});
	}
	
	// --- Pagination Rendering ---
	function renderPagination(itemType, pagination) {
		const { totalItems, itemsPerPage, currentPage, totalPages } = pagination;
		const $paginationContainer = $(`#${itemType}Pagination`);
		$paginationContainer.empty();
		
		if (totalPages <= 1) {
			return;
		}
		
		let paginationHtml = '';
		paginationHtml += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                            <a class="page-link" href="#" data-page="${currentPage - 1}" data-type="${itemType}" aria-label="Previous">
                                <span aria-hidden="true">«</span>
                            </a>
                          </li>`;
		
		const maxPagesToShow = 5;
		let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
		let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
		startPage = Math.max(1, endPage - maxPagesToShow + 1);
		
		
		if (startPage > 1) {
			paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="1" data-type="${itemType}">1</a></li>`;
			if (startPage > 2) {
				paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
			}
		}
		
		for (let i = startPage; i <= endPage; i++) {
			paginationHtml += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                                <a class="page-link" href="#" data-page="${i}" data-type="${itemType}">${i}</a>
                              </li>`;
		}
		
		if (endPage < totalPages) {
			if (endPage < totalPages - 1) {
				paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
			}
			paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}" data-type="${itemType}">${totalPages}</a></li>`;
		}
		
		paginationHtml += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                            <a class="page-link" href="#" data-page="${currentPage + 1}" data-type="${itemType}" aria-label="Next">
                                <span aria-hidden="true">»</span>
                            </a>
                          </li>`;
		$paginationContainer.html(paginationHtml);
	}
	
	
	// --- Event Handlers ---
	fetchCoverTypes().then(() => { // Ensure types are fetched before initial load
		const activeTabButton = $('#adminTab button[data-bs-toggle="tab"].active');
		if (activeTabButton.length) {
			const initialTargetPanelId = activeTabButton.data('bs-target');
			const initialItemType = initialTargetPanelId.replace('#', '').replace('-panel', '');
			const state = getCurrentState(initialItemType);
			loadItems(initialItemType, state.page, state.search, state.coverTypeId);
		} else {
			loadItems('covers'); // Default if no active tab found
		}
	});
	
	
	$('#adminTab button[data-bs-toggle="tab"]').on('shown.bs.tab', function (event) {
		const targetPanelId = $(event.target).data('bs-target');
		const itemType = targetPanelId.replace('#', '').replace('-panel', '');
		const state = getCurrentState(itemType);
		loadItems(itemType, state.page, state.search, state.coverTypeId);
	});
	
	// Cover Type Filter Change
	$(document).on('change', '.cover-type-filter', function() {
		const itemType = $(this).data('type');
		const coverTypeId = $(this).val();
		const state = getCurrentState(itemType);
		loadItems(itemType, 1, state.search, coverTypeId); // Reset to page 1 on filter change
	});
	
	
	$('form[id^="upload"]').on('submit', function(e) {
		e.preventDefault();
		const $form = $(this);
		const itemType = $form.find('input[name="item_type"]').val();
		const $submitButton = $form.find('button[type="submit"]');
		const originalButtonText = $submitButton.html();
		$submitButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...');
		
		let filesToUpload = [];
		let commonFormDataFields = {};
		
		const formElements = this.elements;
		for (let i = 0; i < formElements.length; i++) {
			const element = formElements[i];
			if (element.name && element.name !== 'name' && element.type !== 'file' && element.name !== 'item_type' && element.name !== 'action') {
				if ((element.type === 'checkbox' || element.type === 'radio') && element.checked) {
					commonFormDataFields[element.name] = element.value;
				} else if (element.type !== 'checkbox' && element.type !== 'radio') {
					commonFormDataFields[element.name] = element.value;
				}
			}
		}
		// Ensure cover_type_id is included if present in the form
		if ($form.find('select[name="cover_type_id"]').length) {
			commonFormDataFields['cover_type_id'] = $form.find('select[name="cover_type_id"]').val();
		}
		
		
		let nameInputVal = $form.find('input[name="name"]').val();
		
		if (itemType === 'covers' || itemType === 'elements' || itemType === 'overlays') {
			const imageFilesInput = $form.find('input[name="image_file"]')[0];
			const imageFiles = imageFilesInput.files;
			if (imageFiles.length === 0 && imageFilesInput.required) {
				showAlert('Image file(s) are required.', 'danger');
				$submitButton.prop('disabled', false).html(originalButtonText);
				return;
			}
			for (let i = 0; i < imageFiles.length; i++) {
				filesToUpload.push({
					type: 'image',
					file: imageFiles[i],
					derivedName: (imageFiles.length === 1 && nameInputVal) ? nameInputVal : deriveNameFromFilename(imageFiles[i].name)
				});
			}
		} else if (itemType === 'templates') {
			const jsonFilesInput = $form.find('input[name="json_file"]')[0];
			const thumbnailFilesInput = $form.find('input[name="thumbnail_file"]')[0];
			const jsonFiles = jsonFilesInput.files;
			const thumbnailFiles = thumbnailFilesInput.files;
			
			if ((jsonFiles.length === 0 && jsonFilesInput.required) || (thumbnailFiles.length === 0 && thumbnailFilesInput.required)) {
				showAlert('Both JSON and Thumbnail file(s) are required for templates.', 'danger');
				$submitButton.prop('disabled', false).html(originalButtonText);
				return;
			}
			if (jsonFiles.length !== thumbnailFiles.length) {
				showAlert('The number of JSON files must match the number of Thumbnail files.', 'danger');
				$submitButton.prop('disabled', false).html(originalButtonText);
				return;
			}
			for (let i = 0; i < jsonFiles.length; i++) {
				filesToUpload.push({
					type: 'template',
					json_file: jsonFiles[i],
					thumbnail_file: thumbnailFiles[i],
					derivedName: (jsonFiles.length === 1 && nameInputVal) ? nameInputVal : deriveNameFromFilename(jsonFiles[i].name)
				});
			}
		}
		
		
		if (filesToUpload.length === 0) {
			showAlert('No files selected for upload.', 'warning');
			$submitButton.prop('disabled', false).html(originalButtonText);
			return;
		}
		
		let uploadPromises = [];
		let successCount = 0;
		let errorCount = 0;
		$submitButton.html(`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading 0/${filesToUpload.length}...`);
		
		filesToUpload.forEach((uploadItem, index) => {
			const formData = new FormData();
			formData.append('action', 'upload_item');
			formData.append('item_type', itemType);
			formData.append('name', uploadItem.derivedName);
			
			for (const key in commonFormDataFields) {
				formData.append(key, commonFormDataFields[key]);
			}
			
			if (uploadItem.type === 'image') {
				formData.append('image_file', uploadItem.file, uploadItem.file.name);
			} else if (uploadItem.type === 'template') {
				formData.append('json_file', uploadItem.json_file, uploadItem.json_file.name);
				formData.append('thumbnail_file', uploadItem.thumbnail_file, uploadItem.thumbnail_file.name);
			}
			
			const promise = $.ajax({
				url: API_URL,
				type: 'POST',
				data: formData,
				processData: false,
				contentType: false,
				dataType: 'json'
			}).done(function(response) {
				if (response.success) {
					successCount++;
				} else {
					errorCount++;
					showAlert(`Error uploading "${escapeHtml(uploadItem.derivedName)}": ${escapeHtml(response.message)}`, 'danger');
				}
			}).fail(function(xhr, status, error) {
				errorCount++;
				showAlert(`AJAX Error uploading "${escapeHtml(uploadItem.derivedName)}": ${escapeHtml(xhr.responseText || error)}`, 'danger');
				console.error("AJAX Error:", status, error, xhr.responseText);
			}).always(function() {
				$submitButton.html(`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading ${successCount + errorCount}/${filesToUpload.length}...`);
			});
			uploadPromises.push(promise);
		});
		
		Promise.allSettled(uploadPromises).then(() => {
			$submitButton.prop('disabled', false).html(originalButtonText);
			if (successCount > 0) {
				$form[0].reset();
				const currentActiveItemType = $('#adminTab button.active').data('bs-target').replace('#', '').replace('-panel', '');
				const state = getCurrentState(itemType); // Get current state including coverTypeId
				if (currentActiveItemType === itemType) {
					loadItems(itemType, 1, '', state.coverTypeId); // Reload to first page, keep filter
				} else {
					setCurrentState(itemType, 1, '', state.coverTypeId);
				}
			}
			
			if (errorCount === 0 && successCount > 0) {
				showAlert(`Successfully uploaded ${successCount} item(s).`, 'success');
			} else if (errorCount > 0 && successCount === 0) {
				showAlert(`All ${filesToUpload.length} uploads failed. Please check error messages.`, 'danger');
			} else if (errorCount > 0 && successCount > 0) {
				showAlert(`${successCount} of ${filesToUpload.length} items uploaded successfully. ${errorCount} failed.`, 'warning');
			}
		});
	});
	
	$('.tab-content').on('click', '.delete-item', function() {
		const $button = $(this);
		const itemId = $button.data('id');
		const itemType = $button.data('type');
		if (confirm(`Are you sure you want to delete this ${itemType.slice(0, -1)} (ID: ${itemId})? This action cannot be undone.`)) {
			const originalButtonHtml = $button.html();
			$button.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>');
			$.ajax({
				url: API_URL,
				type: 'POST',
				data: { action: 'delete_item', item_type: itemType, id: itemId },
				dataType: 'json',
				success: function(response) {
					if (response.success) {
						showAlert(`${capitalizeFirstLetter(itemType).slice(0,-1)} deleted successfully!`, 'success');
						const state = getCurrentState(itemType);
						loadItems(itemType, state.page, state.search, state.coverTypeId);
					} else {
						showAlert(`Error deleting ${itemType}: ${escapeHtml(response.message)}`, 'danger');
						$button.prop('disabled', false).html(originalButtonHtml);
					}
				},
				error: function(xhr, status, error) {
					showAlert(`AJAX Error deleting ${itemType}: ${escapeHtml(xhr.responseText || error)}`, 'danger');
					$button.prop('disabled', false).html(originalButtonHtml);
					console.error("AJAX Error:", status, error, xhr.responseText);
				}
			});
		}
	});
	
	$('.tab-content').on('click', '.pagination .page-link', function(e) {
		e.preventDefault();
		const $link = $(this);
		if ($link.parent().hasClass('disabled') || $link.parent().hasClass('active')) {
			return;
		}
		const itemType = $link.data('type');
		const page = $link.data('page');
		const state = getCurrentState(itemType);
		loadItems(itemType, page, state.search, state.coverTypeId);
	});
	
	$('.tab-content').on('submit', '.search-form', function(e) {
		e.preventDefault();
		const $form = $(this);
		const itemType = $form.data('type');
		const searchQuery = $form.find('.search-input').val().trim();
		const coverTypeId = $form.find('.cover-type-filter').val(); // Get filter value
		loadItems(itemType, 1, searchQuery, coverTypeId);
	});
	
	// --- Edit Functionality ---
	const $editModal = $('#editItemModal');
	const $editForm = $('#editItemForm');
	const editModal = new bootstrap.Modal($editModal[0]);
	
	$('.tab-content').on('click', '.edit-item', function() {
		const $button = $(this);
		const itemId = $button.data('id');
		const itemType = $button.data('type');
		
		$editModal.find('.modal-title').text(`Loading ${capitalizeFirstLetter(itemType).slice(0,-1)}...`);
		$editForm[0].reset();
		$('#editCurrentImagePreview').empty().hide();
		$('#editCurrentThumbnailPreview').empty().hide();
		$('#editCurrentJsonInfo').hide();
		$('.edit-field').hide();
		
		$.ajax({
			url: API_URL,
			type: 'GET',
			data: { action: 'get_item_details', item_type: itemType, id: itemId },
			dataType: 'json',
			success: function(response) {
				if (response.success) {
					const item = response.data;
					$editModal.find('.modal-title').text(`Edit ${capitalizeFirstLetter(itemType).slice(0,-1)}: ${escapeHtml(item.name)}`);
					$('#editItemId').val(item.id);
					$('#editItemType').val(itemType);
					$('#editItemName').val(item.name);
					
					$(`.edit-field-${itemType}`).show();
					
					if (itemType === 'covers') {
						$('#editItemCaption').val(item.caption || '');
						$('#editItemKeywords').val(item.keywords || '');
						$('#editItemCategories').val(item.categories || '');
						$('#editItemCoverType').val(item.cover_type_id || ''); // Set cover type
						if(item.image_url) {
							$('#editCurrentImagePreview').html(`<p class="mb-1">Current Image:</p><img src="${escapeHtml(item.image_url)}" alt="Current Preview">`).show();
						}
					} else if (itemType === 'elements' || itemType === 'overlays') {
						$('#editItemKeywords').val(item.keywords || '');
						if(item.image_url) {
							$('#editCurrentImagePreview').html(`<p class="mb-1">Current Image:</p><img src="${escapeHtml(item.image_url)}" alt="Current Preview">`).show();
						}
					} else if (itemType === 'templates') {
						$('#editItemKeywords').val(item.keywords || '');
						$('#editItemCoverType').val(item.cover_type_id || ''); // Set cover type
						if(item.thumbnail_url) {
							$('#editCurrentThumbnailPreview').html(`<p class="mb-1">Current Thumbnail:</p><img src="${escapeHtml(item.thumbnail_url)}" alt="Current Thumbnail">`).show();
						}
						$('#editCurrentJsonInfo').text('Current JSON data is loaded. Upload a new file to replace it.').show();
					}
					editModal.show();
				} else {
					showAlert(`Error fetching details for ${itemType} ID ${itemId}: ${escapeHtml(response.message)}`, 'danger');
				}
			},
			error: function(xhr, status, error) {
				showAlert(`AJAX Error fetching details: ${escapeHtml(xhr.responseText || error)}`, 'danger');
				console.error("AJAX Error:", status, error, xhr.responseText);
			}
		});
	});
	
	$editForm.on('submit', function(e) {
		e.preventDefault();
		const formData = new FormData(this);
		formData.append('action', 'update_item');
		const itemType = $('#editItemType').val();
		const $submitButton = $('#saveEditButton');
		const originalButtonText = $submitButton.html();
		$submitButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...');
		
		$.ajax({
			url: API_URL,
			type: 'POST',
			data: formData,
			processData: false,
			contentType: false,
			dataType: 'json',
			success: function(response) {
				if (response.success) {
					showAlert(`${capitalizeFirstLetter(itemType).slice(0,-1)} updated successfully!`, 'success');
					editModal.hide();
					const state = getCurrentState(itemType);
					loadItems(itemType, state.page, state.search, state.coverTypeId);
				} else {
					showAlert(`Error updating ${itemType}: ${escapeHtml(response.message)}`, 'danger');
				}
			},
			error: function(xhr, status, error) {
				showAlert(`AJAX Error updating ${itemType}: ${escapeHtml(xhr.responseText || error)}`, 'danger');
				console.error("AJAX Error:", status, error, xhr.responseText);
			},
			complete: function() {
				$submitButton.prop('disabled', false).html(originalButtonText);
			}
		});
	});
	
	$editModal.on('hidden.bs.modal', function () {
		$('#editItemImageFile').val('');
		$('#editItemThumbnailFile').val('');
		$('#editItemJsonFile').val('');
		$('#editCurrentImagePreview').empty().hide();
		$('#editCurrentThumbnailPreview').empty().hide();
		$('#editItemCoverType').val(''); // Reset cover type dropdown in edit modal
	});
	
	
	// --- AI Metadata Generation Handler ---
	$('.tab-content').on('click', '.generate-ai-metadata', function() {
		const $button = $(this);
		const itemId = $button.data('id');
		const itemType = $button.data('type');
		
		if (!confirm(`Are you sure you want to generate AI metadata for this ${itemType.slice(0, -1)} (ID: ${itemId})? This may overwrite existing caption, keywords, and categories with AI-generated values.`)) {
			return;
		}
		const originalButtonHtml = $button.html();
		$button.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> AI...');
		
		$.ajax({
			url: API_URL,
			type: 'POST',
			data: { action: 'generate_ai_metadata', item_type: itemType, id: itemId },
			dataType: 'json',
			success: function(response) {
				if (response.success) {
					showAlert(`${capitalizeFirstLetter(itemType).slice(0,-1)} AI metadata generated/updated successfully!`, 'success');
					const state = getCurrentState(itemType);
					loadItems(itemType, state.page, state.search, state.coverTypeId);
				} else {
					showAlert(`Error generating AI metadata for ${itemType}: ${escapeHtml(response.message)}`, 'danger');
				}
			},
			error: function(xhr, status, error) {
				showAlert(`AJAX Error generating AI metadata for ${itemType}: ${escapeHtml(xhr.responseText || error)}`, 'danger');
				console.error("AJAX Error (AI Metadata):", status, error, xhr.responseText);
			},
			complete: function() {
				$button.prop('disabled', false).html(originalButtonHtml);
			}
		});
	});
	
	// --- NEW: AI Similar Template Generation ---
	const $generateSimilarTemplateModal = $('#generateSimilarTemplateModal');
	const generateSimilarTemplateModal = new bootstrap.Modal($generateSimilarTemplateModal[0]);
	const $generateSimilarTemplateForm = $('#generateSimilarTemplateForm');
	
	$('.tab-content').on('click', '.generate-similar-template', function() {
		const itemId = $(this).data('id');
		$('#aiOriginalTemplatePreview').text('Loading original template...');
		$('#aiTemplatePrompt').val('');
		
		$.ajax({
			url: API_URL,
			type: 'GET',
			data: { action: 'get_item_details', item_type: 'templates', id: itemId },
			dataType: 'json',
			success: function(response) {
				if (response.success && response.data.json_content) {
					const item = response.data;
					$('#aiOriginalTemplateId').val(item.id);
					$('#aiOriginalTemplateJsonContent').val(item.json_content);
					
					try {
						const prettyJson = JSON.stringify(JSON.parse(item.json_content), null, 2);
						$('#aiOriginalTemplatePreview').text(prettyJson);
					} catch (e) {
						$('#aiOriginalTemplatePreview').text(item.json_content);
						showAlert('Original template JSON is not valid, showing raw content.', 'warning');
					}
					
					const defaultPrompt = `Create a JSON file similar to the example above. Make sure all fields for each layer are present. Make the ID's unique and human readable like title-1, author-1, artist-1, etc. Change the resolution to 3000x3000 and update the theme to something new. Change fonts, colors, shadows and other properties to make it unique.`;
					$('#aiTemplatePrompt').val(defaultPrompt);
					
					$generateSimilarTemplateModal.find('.modal-title').text(`Generate Similar to: ${escapeHtml(item.name)}`);
					generateSimilarTemplateModal.show();
				} else {
					showAlert(`Error fetching template details or JSON content missing: ${escapeHtml(response.message || 'Unknown error')}`, 'danger');
					$('#aiOriginalTemplatePreview').text('Failed to load original template.');
				}
			},
			error: function(xhr, status, error) {
				showAlert(`AJAX Error fetching template details: ${escapeHtml(xhr.responseText || error)}`, 'danger');
				$('#aiOriginalTemplatePreview').text('Failed to load original template.');
			}
		});
	});
	
	$generateSimilarTemplateForm.on('submit', function(e) {
		e.preventDefault();
		const $submitButton = $('#submitAiGenerateTemplateButton');
		const originalButtonText = $submitButton.html();
		$submitButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...');
		
		const formData = {
			action: 'generate_similar_template',
			item_type: 'templates',
			original_template_id: $('#aiOriginalTemplateId').val(),
			original_json_content: $('#aiOriginalTemplateJsonContent').val(),
			user_prompt: $('#aiTemplatePrompt').val()
		};
		
		$.ajax({
			url: API_URL,
			type: 'POST',
			data: formData,
			dataType: 'json',
			success: function(response) {
				if (response.success && response.data && response.data.generated_json_content && response.data.filename) {
					const filename = response.data.filename;
					const jsonContent = response.data.generated_json_content;
					const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
					const link = document.createElement("a");
					
					if (link.download !== undefined) { // Check if HTML5 download attribute is supported
						const url = URL.createObjectURL(blob);
						link.setAttribute("href", url);
						link.setAttribute("download", filename);
						link.style.visibility = 'hidden';
						document.body.appendChild(link);
						link.click();
						document.body.removeChild(link);
						URL.revokeObjectURL(url);
						showAlert(`AI-generated template "${escapeHtml(filename)}" is being downloaded.`, 'success');
					} else {
						// Fallback for older browsers
						showAlert('Generated JSON content is ready, but your browser does not support direct download. Please copy the content manually if needed.', 'warning');
						console.log("Generated JSON for manual copy:", jsonContent);
					}
					generateSimilarTemplateModal.hide();
				} else {
					showAlert(`Error generating similar template: ${escapeHtml(response.message || 'Unknown error. Check console.')}`, 'danger');
				}
			},
			error: function(xhr, status, error) {
				showAlert(`AJAX Error generating similar template: ${escapeHtml(xhr.responseText || error)}`, 'danger');
				console.error("AJAX Error (Generate Similar Template):", status, error, xhr.responseText);
			},
			complete: function() {
				$submitButton.prop('disabled', false).html(originalButtonText);
			}
		});
	});
	
	$generateSimilarTemplateModal.on('hidden.bs.modal', function () {
		$('#aiOriginalTemplatePreview').text('Loading original template...');
		$('#aiTemplatePrompt').val('');
		$('#aiOriginalTemplateId').val('');
		$('#aiOriginalTemplateJsonContent').val('');
		$generateSimilarTemplateForm[0].reset();
	});
	
});
