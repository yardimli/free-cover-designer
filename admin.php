<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Admin - Cover Designer</title>
	<link href="vendors/bootstrap5.3.5/css/bootstrap.min.css" rel="stylesheet">
	<link rel="stylesheet" href="vendors/fontawesome-free-6.7.2/css/all.min.css">
	<link rel="stylesheet" href="css/admin.css">


	<link rel="apple-touch-icon" sizes="180x180" href="images/apple-touch-icon.png">
	<link rel="icon" type="image/png" sizes="32x32" href="images/favicon-32x32.png">
	<link rel="icon" type="image/png" sizes="16x16" href="images/favicon-16x16.png">
	<link rel="manifest" href="images/site.webmanifest">

</head>
<body>
<nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top">
	<div class="container-fluid">
		<a class="navbar-brand" href="#">Cover Designer Admin</a>
		<a href="index.php" class="btn btn-sm btn-outline-light" target="_blank">View App</a>
	</div>
</nav>

<div class="container admin-container">
	<div id="alert-messages-container" class="alert-messages"></div>

	<ul class="nav nav-tabs" id="adminTab" role="tablist">
		<li class="nav-item" role="presentation">
			<button class="nav-link active" id="covers-tab" data-bs-toggle="tab" data-bs-target="#covers-panel" type="button" role="tab" aria-controls="covers-panel" aria-selected="true">Covers</button>
		</li>
		<li class="nav-item" role="presentation">
			<button class="nav-link" id="templates-tab" data-bs-toggle="tab" data-bs-target="#templates-panel" type="button" role="tab" aria-controls="templates-panel" aria-selected="false">Templates</button>
		</li>
		<li class="nav-item" role="presentation">
			<button class="nav-link" id="elements-tab" data-bs-toggle="tab" data-bs-target="#elements-panel" type="button" role="tab" aria-controls="elements-panel" aria-selected="false">Elements</button>
		</li>
		<li class="nav-item" role="presentation">
			<button class="nav-link" id="overlays-tab" data-bs-toggle="tab" data-bs-target="#overlays-panel" type="button" role="tab" aria-controls="overlays-panel" aria-selected="false">Overlays</button>
		</li>
	</ul>

	<div class="tab-content" id="adminTabContent">
		<!-- Covers Panel -->
		<div class="tab-pane fade show active" id="covers-panel" role="tabpanel" aria-labelledby="covers-tab">
			<h3>Manage Covers</h3>
			<!-- Upload Form -->
			<div class="upload-form mb-4">
				<h4>Upload New Cover(s)</h4>
				<form id="uploadCoverForm" enctype="multipart/form-data">
					<input type="hidden" name="item_type" value="covers">
					<div class="mb-3">
						<label for="coverName" class="form-label">Name (will be derived from filename if left blank)</label>
						<input type="text" class="form-control" id="coverName" name="name">
					</div>
					<div class="mb-3">
						<label for="coverImage" class="form-label">Cover Image(s) (PNG, JPG, GIF)</label>
						<input type="file" class="form-control" id="coverImage" name="image_file" accept="image/png, image/jpeg, image/gif" required multiple>
					</div>
					<div class="mb-3">
						<label for="coverCoverType" class="form-label">Cover Type</label>
						<select class="form-select admin-cover-type-dropdown" id="coverCoverType" name="cover_type_id">
							<option value="">Select Cover Type</option>
							<!-- Populated by JS -->
						</select>
					</div>
					<div class="mb-3">
						<label for="coverCaption" class="form-label">Caption (Optional, applies to all selected files)</label>
						<textarea class="form-control" id="coverCaption" name="caption" rows="2"></textarea>
					</div>
					<div class="mb-3">
						<label for="coverKeywords" class="form-label">Keywords (comma-separated, applies to all selected files)</label>
						<input type="text" class="form-control" id="coverKeywords" name="keywords">
					</div>
					<div class="mb-3">
						<label for="coverCategories" class="form-label">Categories (comma-separated, applies to all selected files)</label>
						<input type="text" class="form-control" id="coverCategories" name="categories">
					</div>
					<button type="submit" class="btn btn-primary">Upload Cover(s)</button>
				</form>
			</div>

			<!-- Existing Items -->
			<h4>Existing Covers</h4>
			<form class="mb-3 search-form row g-3 align-items-center" data-type="covers">
				<div class="col-md-9">
					<div class="input-group">
						<input type="search" class="form-control search-input" placeholder="Search Covers (Name, Caption, Keywords, Categories)..." aria-label="Search Covers">
						<button class="btn btn-outline-secondary" type="submit">Search</button>
					</div>
				</div>
				<div class="col-md-3">
					<select class="form-select cover-type-filter admin-cover-type-dropdown" data-type="covers" aria-label="Filter by Cover Type">
						<option value="">All Cover Types</option>
						<!-- Populated by JS -->
					</select>
				</div>
			</form>
			<div class="table-responsive">
				<table class="table table-striped item-table" id="coversTable">
					<thead>
					<tr>
						<th>Preview</th>
						<th>Name</th>
						<th>Cover Type</th>
						<th>Caption</th>
						<th>Keywords</th>
						<th>Categories</th>
						<th>Actions</th>
					</tr>
					</thead>
					<tbody><!-- Populated by JS --></tbody>
				</table>
			</div>
			<nav aria-label="Covers pagination">
				<ul class="pagination justify-content-center" id="coversPagination"></ul>
			</nav>
		</div>

		<!-- Templates Panel -->
		<div class="tab-pane fade" id="templates-panel" role="tabpanel" aria-labelledby="templates-tab">
			<h3>Manage Templates</h3>
			<div class="upload-form mb-4">
				<h4>Upload New Template(s)</h4>
				<form id="uploadTemplateForm" enctype="multipart/form-data">
					<input type="hidden" name="item_type" value="templates">
					<div class="mb-3">
						<label for="templateName" class="form-label">Name (will be derived from JSON filename if files if left blank)</label>
						<input type="text" class="form-control" id="templateName" name="name">
					</div>
					<div class="mb-3">
						<label for="templateJson" class="form-label">Template JSON File(s) (.json)</label>
						<input type="file" class="form-control" id="templateJson" name="json_file" accept=".json" required multiple>
					</div>
					<div class="mb-3">
						<label for="templateThumbnail" class="form-label">Corresponding Thumbnail Image(s) (PNG, JPG, GIF)</label>
						<input type="file" class="form-control" id="templateThumbnail" name="thumbnail_file" accept="image/png, image/jpeg, image/gif" required multiple>
						<div class="form-text">Select the same number of thumbnail files as JSON files, in the same order.</div>
					</div>
					<div class="mb-3">
						<label for="templateCoverType" class="form-label">Cover Type</label>
						<select class="form-select admin-cover-type-dropdown" id="templateCoverType" name="cover_type_id">
							<option value="">Select Cover Type</option>
							<!-- Populated by JS -->
						</select>
					</div>
					<div class="mb-3">
						<label for="templateKeywords" class="form-label">Keywords (comma-separated, optional, applies to all selected files)</label>
						<input type="text" class="form-control" id="templateKeywords" name="keywords">
					</div>
					<button type="submit" class="btn btn-primary">Upload Template(s)</button>
				</form>
			</div>
			<h4>Existing Templates</h4>
			<form class="mb-3 search-form row g-3 align-items-center" data-type="templates">
				<div class="col-md-9">
					<div class="input-group">
						<input type="search" class="form-control search-input" placeholder="Search Templates (Name, Keywords)..." aria-label="Search Templates">
						<button class="btn btn-outline-secondary" type="submit">Search</button>
					</div>
				</div>
				<div class="col-md-3">
					<select class="form-select cover-type-filter admin-cover-type-dropdown" data-type="templates" aria-label="Filter by Cover Type">
						<option value="">All Cover Types</option>
						<!-- Populated by JS -->
					</select>
				</div>
			</form>
			<div class="table-responsive">
				<table class="table table-striped item-table" id="templatesTable">
					<thead>
					<tr>
						<th>Preview</th>
						<th>Name</th>
						<th>Cover Type</th>
						<th>Keywords</th>
						<th>Actions</th>
					</tr>
					</thead>
					<tbody></tbody>
				</table>
			</div>
			<nav aria-label="Templates pagination">
				<ul class="pagination justify-content-center" id="templatesPagination"></ul>
			</nav>
		</div>

		<!-- Elements Panel -->
		<div class="tab-pane fade" id="elements-panel" role="tabpanel" aria-labelledby="elements-tab">
			<h3>Manage Elements</h3>
			<div class="upload-form mb-4">
				<h4>Upload New Element(s)</h4>
				<form id="uploadElementForm" enctype="multipart/form-data">
					<input type="hidden" name="item_type" value="elements">
					<div class="mb-3">
						<label for="elementName" class="form-label">Name (will be derived from filename if left blank)</label>
						<input type="text" class="form-control" id="elementName" name="name">
					</div>
					<div class="mb-3">
						<label for="elementImage" class="form-label">Element Image(s) (PNG, JPG, GIF)</label>
						<input type="file" class="form-control" id="elementImage" name="image_file" accept="image/png, image/jpeg, image/gif" required multiple>
					</div>
					<div class="mb-3">
						<label for="elementKeywords" class="form-label">Keywords (comma-separated, applies to all selected files)</label>
						<input type="text" class="form-control" id="elementKeywords" name="keywords">
					</div>
					<button type="submit" class="btn btn-primary">Upload Element(s)</button>
				</form>
			</div>
			<h4>Existing Elements</h4>
			<form class="mb-3 search-form" data-type="elements">
				<div class="input-group">
					<input type="search" class="form-control search-input" placeholder="Search Elements (Name, Keywords)..." aria-label="Search Elements">
					<button class="btn btn-outline-secondary" type="submit">Search</button>
				</div>
			</form>
			<div class="table-responsive">
				<table class="table table-striped item-table" id="elementsTable">
					<thead>
					<tr>
						<th>Preview</th>
						<th>Name</th>
						<th>Keywords</th>
						<th>Actions</th>
					</tr>
					</thead>
					<tbody></tbody>
				</table>
			</div>
			<nav aria-label="Elements pagination">
				<ul class="pagination justify-content-center" id="elementsPagination"></ul>
			</nav>
		</div>

		<!-- Overlays Panel -->
		<div class="tab-pane fade" id="overlays-panel" role="tabpanel" aria-labelledby="overlays-tab">
			<h3>Manage Overlays</h3>
			<div class="upload-form mb-4">
				<h4>Upload New Overlay(s)</h4>
				<form id="uploadOverlayForm" enctype="multipart/form-data">
					<input type="hidden" name="item_type" value="overlays">
					<div class="mb-3">
						<label for="overlayName" class="form-label">Name (will be derived from filename if left blank)</label>
						<input type="text" class="form-control" id="overlayName" name="name">
					</div>
					<div class="mb-3">
						<label for="overlayImage" class="form-label">Overlay Image(s) (PNG, JPG, GIF)</label>
						<input type="file" class="form-control" id="overlayImage" name="image_file" accept="image/png, image/jpeg, image/gif" required multiple>
					</div>
					<div class="mb-3">
						<label for="overlayKeywords" class="form-label">Keywords (comma-separated, applies to all selected files)</label>
						<input type="text" class="form-control" id="overlayKeywords" name="keywords">
					</div>
					<button type="submit" class="btn btn-primary">Upload Overlay(s)</button>
				</form>
			</div>
			<h4>Existing Overlays</h4>
			<form class="mb-3 search-form" data-type="overlays">
				<div class="input-group">
					<input type="search" class="form-control search-input" placeholder="Search Overlays (Name, Keywords)..." aria-label="Search Overlays">
					<button class="btn btn-outline-secondary" type="submit">Search</button>
				</div>
			</form>
			<div class="table-responsive">
				<table class="table table-striped item-table" id="overlaysTable">
					<thead>
					<tr>
						<th>Preview</th>
						<th>Name</th>
						<th>Keywords</th>
						<th>Actions</th>
					</tr>
					</thead>
					<tbody></tbody>
				</table>
			</div>
			<nav aria-label="Overlays pagination">
				<ul class="pagination justify-content-center" id="overlaysPagination"></ul>
			</nav>
		</div>
	</div> <!-- /tab-content -->
</div> <!-- /container -->

<!-- Edit Item Modal -->
<div class="modal fade" id="editItemModal" tabindex="-1" aria-labelledby="editItemModalLabel" aria-hidden="true">
	<div class="modal-dialog modal-lg">
		<div class="modal-content">
			<form id="editItemForm" enctype="multipart/form-data">
				<div class="modal-header">
					<h5 class="modal-title" id="editItemModalLabel">Edit Item</h5>
					<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
				</div>
				<div class="modal-body">
					<input type="hidden" name="id" id="editItemId">
					<input type="hidden" name="item_type" id="editItemType">

					<div class="mb-3">
						<label for="editItemName" class="form-label">Name</label>
						<input type="text" class="form-control" id="editItemName" name="name" required>
					</div>

					<!-- Cover Type Dropdown (for Covers and Templates) -->
					<div class="mb-3 edit-field edit-field-covers edit-field-templates">
						<label for="editItemCoverType" class="form-label">Cover Type</label>
						<select class="form-select admin-cover-type-dropdown" id="editItemCoverType" name="cover_type_id">
							<option value="">Select Cover Type</option>
							<!-- Populated by JS -->
						</select>
					</div>

					<!-- Fields specific to Covers -->
					<div class="mb-3 edit-field edit-field-covers">
						<label for="editItemCaption" class="form-label">Caption</label>
						<textarea class="form-control" id="editItemCaption" name="caption" rows="2"></textarea>
					</div>
					<div class="mb-3 edit-field edit-field-covers">
						<label for="editItemCategories" class="form-label">Categories (comma-separated)</label>
						<input type="text" class="form-control" id="editItemCategories" name="categories">
					</div>

					<!-- Fields specific to Covers, Elements, Overlays, AND TEMPLATES (for keywords) -->
					<div class="mb-3 edit-field edit-field-covers edit-field-elements edit-field-overlays edit-field-templates">
						<label for="editItemKeywords" class="form-label">Keywords (comma-separated)</label>
						<input type="text" class="form-control" id="editItemKeywords" name="keywords">
					</div>

					<!-- Image Upload (Covers, Elements, Overlays) -->
					<div class="mb-3 edit-field edit-field-covers edit-field-elements edit-field-overlays">
						<label for="editItemImageFile" class="form-label">Replace Image (Optional)</label>
						<input type="file" class="form-control" id="editItemImageFile" name="image_file" accept="image/png, image/jpeg, image/gif">
						<div class="form-text">Leave empty to keep the current image. Uploading a new image will replace the original and regenerate the thumbnail.</div>
						<div id="editCurrentImagePreview" class="mt-2" style="max-height: 180px; overflow: hidden;"><!-- Content via JS --></div>
					</div>

					<!-- Thumbnail Upload (Templates) -->
					<div class="mb-3 edit-field edit-field-templates">
						<label for="editItemThumbnailFile" class="form-label">Replace Thumbnail (Optional)</label>
						<input type="file" class="form-control" id="editItemThumbnailFile" name="thumbnail_file" accept="image/png, image/jpeg, image/gif">
						<div class="form-text">Leave empty to keep the current thumbnail.</div>
						<div id="editCurrentThumbnailPreview" class="mt-2" style="max-height: 180px; overflow: hidden;"><!-- Content via JS --></div>
					</div>

					<!-- JSON Upload (Templates) -->
					<div class="mb-3 edit-field edit-field-templates">
						<label for="editItemJsonFile" class="form-label">Replace JSON File (Optional)</label>
						<input type="file" class="form-control" id="editItemJsonFile" name="json_file" accept=".json">
						<div class="form-text">Leave empty to keep the current template data.</div>
						<div id="editCurrentJsonInfo" class="mt-2 small text-muted" style="display:none;">Current JSON data loaded.</div>
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
					<button type="submit" class="btn btn-primary" id="saveEditButton">Save Changes</button>
				</div>
			</form>
		</div>
	</div>
</div>

<!-- Generate Similar Template Modal -->
<div class="modal fade" id="generateSimilarTemplateModal" tabindex="-1" aria-labelledby="generateSimilarTemplateModalLabel" aria-hidden="true">
	<div class="modal-dialog modal-lg">
		<div class="modal-content">
			<form id="generateSimilarTemplateForm">
				<div class="modal-header">
					<h5 class="modal-title" id="generateSimilarTemplateModalLabel">Generate Similar Template with AI</h5>
					<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
				</div>
				<div class="modal-body">
					<input type="hidden" id="aiOriginalTemplateId" name="original_template_id">
					<input type="hidden" id="aiOriginalTemplateJsonContent" name="original_json_content">
					<div class="mb-3">
						<p><strong>Original Template (for reference):</strong></p>
						<pre id="aiOriginalTemplatePreview" style="max-height: 200px; overflow-y: auto; background-color: #f8f9fa; padding: 10px; border: 1px solid #dee2e6; white-space: pre-wrap; word-break: break-all;">Loading original template...</pre>
					</div>
					<div class="mb-3">
						<label for="aiTemplatePrompt" class="form-label">Your Prompt for AI:</label>
						<textarea class="form-control" id="aiTemplatePrompt" name="user_prompt" rows="6" required></textarea>
						<div class="form-text">Guide the AI to modify the template. E.g., "Change theme to cyberpunk, main color to neon pink, and add a placeholder for a subtitle."</div>
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
					<button type="submit" class="btn btn-primary" id="submitAiGenerateTemplateButton">Generate & Save File</button>
				</div>
			</form>
		</div>
	</div>
</div>

<script src="vendors/jquery-ui-1.14.1/external/jquery/jquery.js"></script>
<script src="vendors/bootstrap5.3.5/js/bootstrap.bundle.min.js"></script>
<script src="js/admin.js"></script>
</body>
</html>
