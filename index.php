<?php
	require_once 'db.php'; // Include database connection

	// --- Fetch Cover Types ---
	$cover_types_data = [];
	$sql_cover_types = "SELECT id, type_name FROM cover_types ORDER BY type_name ASC";
	if ($result_ct = $mysqlDBConn->query($sql_cover_types)) {
		while ($row_ct = $result_ct->fetch_assoc()) {
			$cover_types_data[] = $row_ct;
		}
		$result_ct->free();
	} else {
		error_log("Error fetching cover types from database: " . $mysqlDBConn->error);
	}
	$cover_types_json = json_encode($cover_types_data);

	// --- Fetch Covers ---
	$covers_data = [];
	// Added cover_type_id to the SELECT statement
	$sql_covers = "SELECT id, cover_type_id, name, thumbnail_path, image_path, caption, keywords, categories FROM covers ORDER BY name ASC";
	if ($result = $mysqlDBConn->query($sql_covers)) {
		while ($row = $result->fetch_assoc()) {
			$covers_data[] = [
				'id' => (int)$row['id'],
				'coverTypeId' => (int)$row['cover_type_id'], // Added coverTypeId
				'name' => $row['name'],
				'thumbnailPath' => $row['thumbnail_path'],
				'imagePath' => $row['image_path'],
				'caption' => $row['caption'],
				'keywords' => $row['keywords'] ? json_decode($row['keywords'], true) : [],
				'categories' => $row['categories'] ? json_decode($row['categories'], true) : []
			];
		}
		$result->free();
	} else {
		error_log("Error fetching covers from database: " . $mysqlDBConn->error);
	}
	$covers_json = json_encode($covers_data);

	// --- Fetch Overlays ---
	$overlays_data = [];
	$sql_overlays = "SELECT id, name, thumbnail_path, image_path, keywords FROM overlays ORDER BY name ASC";
	if ($result = $mysqlDBConn->query($sql_overlays)) {
		while ($row = $result->fetch_assoc()) {
			$overlays_data[] = [
				'id' => (int)$row['id'],
				'name' => $row['name'],
				'thumbnailPath' => $row['thumbnail_path'],
				'imagePath' => $row['image_path'],
				'keywords' => $row['keywords'] ? json_decode($row['keywords'], true) : []
			];
		}
		$result->free();
	} else {
		error_log("Error fetching overlays from database: " . $mysqlDBConn->error);
	}
	$overlays_json = json_encode($overlays_data);

	// --- Fetch Templates ---
	$templates_data = [];
	// Added cover_type_id to the SELECT statement
	$sql_templates = "SELECT id, cover_type_id, name, thumbnail_path, json_content FROM templates ORDER BY name ASC";
	if ($result = $mysqlDBConn->query($sql_templates)) {
		while ($row = $result->fetch_assoc()) {
			$jsonData = $row['json_content'] ? json_decode($row['json_content']) : null;
			if ($jsonData === null && json_last_error() !== JSON_ERROR_NONE) {
				error_log("Error decoding JSON for template ID {$row['id']}: " . json_last_error_msg());
				continue;
			}
			$templates_data[] = [
				'id' => (int)$row['id'],
				'coverTypeId' => (int)$row['cover_type_id'], // Added coverTypeId
				'name' => $row['name'],
				'thumbnailPath' => $row['thumbnail_path'],
				'jsonData' => $jsonData
			];
		}
		$result->free();
	} else {
		error_log("Error fetching templates from database: " . $mysqlDBConn->error);
	}
	$templates_json = json_encode($templates_data);

	// --- Fetch Elements ---
	$elements_data = [];
	$sql_elements = "SELECT id, name, thumbnail_path, image_path, keywords FROM elements ORDER BY name ASC"; // Corrected variable name
	if ($result = $mysqlDBConn->query($sql_elements)) { // Corrected variable name
		while ($row = $result->fetch_assoc()) {
			$elements_data[] = [
				'id' => (int)$row['id'],
				'name' => $row['name'],
				'thumbnailPath' => $row['thumbnail_path'],
				'imagePath' => $row['image_path'],
				'keywords' => $row['keywords'] ? json_decode($row['keywords'], true) : []
			];
		}
		$result->free();
	} else {
		error_log("Error fetching elements from database: " . $mysqlDBConn->error);
	}
	$elements_json = json_encode($elements_data);

	// --- Close DB Connection ---
	if (isset($mysqlDBConn)) {
		$mysqlDBConn->close();
	}
?>
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Book Cover Designer</title>
	<!-- Dependencies -->
	<link href="vendors/bootstrap5.3.5/css/bootstrap.min.css" rel="stylesheet">
	<link rel="stylesheet" href="vendors/fontawesome-free-6.7.2/css/all.min.css">
	<link rel="stylesheet" href="vendors/jquery-ui-1.14.1/jquery-ui.css">
	<link rel="stylesheet" href="vendors/jsfontpicker/dist/jquery.fontpicker.css">
	<link rel="stylesheet" href="css/style.css">
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link rel="apple-touch-icon" sizes="180x180" href="images/apple-touch-icon.png">
	<link rel="icon" type="image/png" sizes="32x32" href="images/favicon-32x32.png">
	<link rel="icon" type="image/png" sizes="16x16" href="images/favicon-16x16.png">
	<link rel="manifest" href="images/site.webmanifest">
</head>
<body>
<div class="app-container d-flex flex-column vh-100">
	<!-- Top Toolbar (Simplified) -->
	<nav class="navbar navbar-expand-sm navbar-dark bg-dark top-toolbar" style="padding: 0px 0px;">
		<div class="container-fluid">
			<span class="navbar-brand mb-0 h1">Free Cover Designer</span>
		</div>
	</nav>
	<!-- Hidden input for loading designs -->
	<input type="file" id="loadDesignInput" accept=".json" style="display: none;">
	<!-- Main Content Area -->
	<div class="d-flex flex-grow-1 overflow-hidden main-content position-relative">
		<!-- Icon Bar (Fixed Width) -->
		<ul class="nav nav-pills flex-column text-center sidebar-nav flex-shrink-0">
			<li class="nav-item"><a class="nav-link" href="#" data-panel-target="#coversPanel" title="Covers"><i class="fas fa-image fa-lg"></i></a></li>
			<li class="nav-item"><a class="nav-link" href="#" data-panel-target="#templatesPanel" title="Templates"><i class="fas fa-th-large fa-lg"></i></a></li>
			<li class="nav-item"><a class="nav-link" href="#" data-panel-target="#elementsPanel" title="Elements"><i class="fas fa-shapes fa-lg"></i></a></li>
			<li class="nav-item"><a class="nav-link" href="#" data-panel-target="#overlaysPanel" title="Overlays"><i class="fas fa-clone fa-lg"></i></a></li>
			<li class="nav-item"><a class="nav-link" href="#" data-panel-target="#uploadPanel" title="Upload"><i class="fas fa-upload fa-lg"></i></a></li>
			<li class="nav-item"><a class="nav-link" href="#" data-panel-target="#layersPanel" title="Layers"><i class="fas fa-layer-group fa-lg"></i></a></li>
			<hr class="mx-2" style="border-top: 1px solid #495057;">
			<li class="nav-item"><a class="nav-link" href="#" id="loadDesignIconBtn" title="Load Design (.json)"><i class="fas fa-folder-open fa-lg"></i></a></li>
			<li class="nav-item"><a class="nav-link" href="#" id="saveDesign" title="Save Design (.json)"><i class="fas fa-save fa-lg"></i></a></li>
			<li class="nav-item"><a class="nav-link" href="#" id="undoBtn" title="Undo"><i class="fas fa-undo fa-lg"></i></a></li>
			<li class="nav-item"><a class="nav-link" href="#" id="redoBtn" title="Redo"><i class="fas fa-redo fa-lg"></i></a></li>
			<li class="nav-item"><a class="nav-link" href="#" id="downloadBtn" title="Download Image (PNG)"><i class="fas fa-download fa-lg"></i></a></li>
		</ul>
		<!-- Sliding Panels Container (Absolute Position) -->
		<div id="sidebar-panels-container" class="closed">
			<!-- Covers Panel -->
			<div id="coversPanel" class="sidebar-panel">
				<div class="panel-content-wrapper">
					<div class="panel-header d-flex align-items-center gap-2"> <!-- Modified for flex layout -->
						<select id="coverTypeFilter" class="form-select form-select-sm" aria-label="Filter by cover type" style="flex-basis: 130px; flex-shrink: 0;">
							<option value="" selected>All Types</option>
							<!-- Options will be populated by JavaScript -->
						</select>
						<input type="search" id="coverSearch" class="form-control form-control-sm" placeholder="Search covers..." style="flex-grow: 1;">
					</div>
					<div id="coverList" class="row item-grid panel-scrollable-content"><p>Loading covers...</p></div>
				</div>
			</div>
			<!-- Templates Panel -->
			<div id="templatesPanel" class="sidebar-panel">
				<div class="panel-content-wrapper">
					<div class="panel-header d-flex align-items-center gap-2"> <!-- Modified for flex layout -->
						<select id="templateTypeFilter" class="form-select form-select-sm" aria-label="Filter by template type" style="flex-basis: 130px; flex-shrink: 0;">
							<option value="" selected>All Types</option>
							<!-- Options will be populated by JavaScript -->
						</select>
						<input type="search" id="templateSearch" class="form-control form-control-sm" placeholder="Search templates..." style="flex-grow: 1;">
					</div>
					<div id="templateList" class="row item-grid panel-scrollable-content"><p>Loading templates...</p></div>
				</div>
			</div>
			<!-- Elements Panel -->
			<div id="elementsPanel" class="sidebar-panel">
				<div class="panel-content-wrapper">
					<div class="panel-header">
						<input type="search" id="elementSearch" class="form-control form-control-sm" placeholder="Search elements...">
					</div>
					<div id="elementList" class="row item-grid panel-scrollable-content"><p>Loading elements...</p></div>
				</div>
			</div>
			<!-- Overlays Panel -->
			<div id="overlaysPanel" class="sidebar-panel">
				<div class="panel-content-wrapper">
					<div class="panel-header">
						<input type="search" id="overlaySearch" class="form-control form-control-sm" placeholder="Search overlays...">
					</div>
					<div id="overlayList" class="row item-grid panel-scrollable-content"><p>Loading overlays...</p></div>
				</div>
			</div>
			<!-- Upload Panel -->
			<div id="uploadPanel" class="sidebar-panel">
				<div class="panel-content-wrapper">
					<div class="panel-header">Upload Image</div>
					<div class="panel-scrollable-content p-2">
						<input type="file" id="imageUploadInput" class="form-control form-control-sm mb-2" accept="image/*">
						<div id="uploadPreview" class="mt-2 text-center mb-2" style="min-height: 50px;"></div>
						<button id="addImageFromUpload" class="btn btn-primary btn-sm w-100" disabled>Add to Canvas</button>
					</div>
				</div>
			</div>
			<!-- Layers Panel -->
			<div id="layersPanel" class="sidebar-panel">
				<div class="panel-content-wrapper">
					<div class="panel-header">Layers</div>
					<div class="panel-scrollable-content">
						<ul id="layerList" class="list-group list-group-flush">
							<li class="list-group-item text-muted">No layers yet.</li>
						</ul>
					</div>
				</div>
			</div>
		</div> <!-- End Sliding Panels Container -->

		<!-- Canvas Area (Takes remaining space) -->
		<div id="canvas-area" class="bg-secondary overflow-auto position-relative flex-grow-1">
			<div id="canvas-wrapper" class="position-relative">
				<div id="canvas" class="bg-white shadow position-relative">
					<!-- Canvas elements added here by JS -->
				</div>
			</div>
			<!-- Zoom Controls -->
			<div id="zoom-controls" class="position-fixed rounded shadow-sm p-1 m-2 bg-dark d-flex align-items-center" style="bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 1060;">
				<button id="zoom-out" class="btn btn-sm me-1" title="Zoom Out"><i class="fas fa-search-minus"></i></button>
				<div class="dropup mx-1">
					<button class="btn btn-sm dropdown-toggle zoom-percentage-display" type="button" id="zoom-percentage-toggle" data-bs-toggle="dropdown" aria-expanded="false">
						100%
					</button>
					<ul class="dropdown-menu dropdown-menu-dark" aria-labelledby="zoom-percentage-toggle" id="zoom-options-menu">
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="0.25">25%</a></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="0.5">50%</a></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="0.75">75%</a></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="1.0">100%</a></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="1.5">150%</a></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="2.0">200%</a></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="3.0">300%</a></li>
						<li><hr class="dropdown-divider"></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="fit">Fit</a></li>
					</ul>
				</div>
				<button id="zoom-in" class="btn btn-sm ms-1" title="Zoom In"><i class="fas fa-search-plus"></i></button>
			</div>
		</div> <!-- End Canvas Area -->

		<!-- Inspector Panel (Remains on the right) -->
		<?php include 'inspectorPanel.php'; ?>
	</div> <!-- End Main Content Area -->
</div> <!-- End App Container -->

<!-- Export Overlay -->
<div id="export-overlay" style="display: none;">
	<div class="export-spinner-content">
		<div class="spinner-border text-light" role="status">
			<span class="visually-hidden">Loading...</span>
		</div>
		<p class="mt-2 text-light" id="loading-overlay-message">Processing...</p>
	</div>
</div>

<!-- Canvas Size Modal -->
<?php include 'canvasSizeModal.php'; ?>

<!-- Embed data -->
<script id="coverTypesData" type="application/json"><?php echo $cover_types_json; ?></script>
<script id="templateData" type="application/json"><?php echo $templates_json; ?></script>
<script id="coverData" type="application/json"><?php echo $covers_json; ?></script>
<script id="elementData" type="application/json"><?php echo $elements_json; ?></script>
<script id="overlayData" type="application/json"><?php echo $overlays_json; ?></script>

<!-- Scripts -->
<script src="vendors/bootstrap5.3.5/js/bootstrap.bundle.min.js"></script>
<script src="vendors/jquery-ui-1.14.1/external/jquery/jquery.js"></script>
<script src="vendors/jquery-ui-1.14.1/jquery-ui.min.js"></script>
<script src="vendors/jsfontpicker/dist/jquery.fontpicker.min.js"></script>
<script type="module" src="vendors/modern-screenshot.js"></script>
<script src="vendors/tinycolor-min.js"></script>
<script src="vendors/moveable.min.js"></script>
<script src="js/LayerManager.js"></script>
<script src="js/HistoryManager.js"></script>
<script src="js/CanvasManager.js"></script>
<script src="js/InspectorPanel.js"></script>
<script src="js/SidebarItemManager.js"></script>
<script src="js/CanvasSizeModal.js"></script>
<script src="js/App.js"></script>
</body>
</html>
