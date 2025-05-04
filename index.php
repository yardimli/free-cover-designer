<?php
	// --- PHP code for scanning templates, covers, elements, overlays remains the same ---
	$template_dir = 'text-templates';
	$templates = [];
	if (is_dir($template_dir)) {
		$files = scandir($template_dir);
		foreach ($files as $file) {
			if (pathinfo($file, PATHINFO_EXTENSION) === 'json') {
				$name = pathinfo($file, PATHINFO_FILENAME);
				$json_path = $template_dir . '/' . $file;
				$thumb_path = $template_dir . '/' . $name . '.png';
				if (file_exists($thumb_path)) {
					$templates[] = [
						'name' => ucwords(str_replace(['-', '_'], ' ', $name)),
						'jsonPath' => $json_path,
						'thumbnailPath' => $thumb_path
					];
				}
			}
		}
	}
	$templates_json = json_encode($templates);

	$covers_json_path = 'data/covers.json';
	$covers_data = [];
	if (file_exists($covers_json_path)) {
		try {
			$json_content = file_get_contents($covers_json_path);
			$raw_covers_data = json_decode($json_content, true);
			if (is_array($raw_covers_data)) {
				$covers_dir = 'covers';
				foreach ($raw_covers_data as $preview_filename => $details) {
					$base_name = pathinfo($preview_filename, PATHINFO_FILENAME);
					if (str_ends_with(strtolower($base_name), '-preview')) {
						$base_name = substr($base_name, 0, -8);
					} else {
						$base_name = pathinfo($preview_filename, PATHINFO_FILENAME);
					}
					$thumbnail_path = $covers_dir . '/' . $preview_filename;
					$target_jpg_path = $covers_dir . '/' . $base_name . '.jpg';
					$target_png_path = $covers_dir . '/' . $base_name . '.png';
					$target_image_path = '';
					if (file_exists($target_jpg_path)) {
						$target_image_path = $target_jpg_path;
					} elseif (file_exists($target_png_path)) {
						$target_image_path = $target_png_path;
					}
					if (file_exists($thumbnail_path) && $target_image_path) {
						$covers_data[] = [
							'name' => ucwords(str_replace(['-', '_'], ' ', $base_name)),
							'thumbnailPath' => $thumbnail_path,
							'imagePath' => $target_image_path,
							'keywords' => isset($details['keywords']) && is_array($details['keywords']) ? $details['keywords'] : [],
							'caption' => isset($details['caption']) ? $details['caption'] : ''
						];
					}
				}
				usort($covers_data, function ($a, $b) {
					return strcmp($a['name'], $b['name']);
				});
			} else {
				error_log("Error: covers.json did not decode into an array.");
			}
		} catch (Exception $e) {
			error_log("Error reading or parsing covers.json: " . $e->getMessage());
		}
	} else {
		error_log("Error: covers.json not found at path: " . $covers_json_path);
	}
	$covers_json = json_encode($covers_data);

	$shapes_dir = 'shapes';
	$elements_data = [];
	if (is_dir($shapes_dir)) {
		$png_files = glob($shapes_dir . '/*.png');
		if ($png_files === false) {
			error_log("Error reading shapes directory: " . $shapes_dir);
		} else {
			foreach ($png_files as $file_path) {
				$filename = basename($file_path);
				$name = pathinfo($filename, PATHINFO_FILENAME);
				$elements_data[] = ['name' => ucwords(str_replace(['-', '_'], ' ', $name)), 'image' => $file_path];
			}
			usort($elements_data, function ($a, $b) {
				return strcmp($a['name'], $b['name']);
			});
		}
	} else {
		error_log("Shapes directory not found: " . $shapes_dir);
	}
	$elements_json = json_encode($elements_data);

	$overlays_json_path = 'data/overlays.json';
	$overlays_data = [];
	if (file_exists($overlays_json_path)) {
		try {
			$json_content = file_get_contents($overlays_json_path);
			$raw_overlays_data = json_decode($json_content, true);
			if (is_array($raw_overlays_data)) {
				$overlays_dir = 'new-overlays';
				foreach ($raw_overlays_data as $preview_filename => $details) {
					$base_name = pathinfo($preview_filename, PATHINFO_FILENAME);
					if (str_ends_with(strtolower($base_name), '-preview')) {
						$base_name = substr($base_name, 0, -8);
					} else {
						$base_name = pathinfo($preview_filename, PATHINFO_FILENAME);
					}
					$thumbnail_path = $overlays_dir . '/' . $preview_filename;
					$target_png_path = $overlays_dir . '/' . $base_name . '.png';
					if (file_exists($thumbnail_path) && file_exists($target_png_path)) {
						$overlays_data[] = [
							'name' => ucwords(str_replace(['-', '_'], ' ', $base_name)),
							'thumbnailPath' => $thumbnail_path,
							'imagePath' => $target_png_path,
							'keywords' => isset($details['keywords']) && is_array($details['keywords']) ? $details['keywords'] : [],
						];
					} else {
						if (!file_exists($thumbnail_path)) error_log("Overlay thumbnail missing: " . $thumbnail_path);
						if (!file_exists($target_png_path)) error_log("Overlay target image missing: " . $target_png_path);
					}
				}
				usort($overlays_data, function ($a, $b) {
					return strcmp($a['name'], $b['name']);
				});
			} else {
				error_log("Error: overlays.json did not decode into an array.");
			}
		} catch (Exception $e) {
			error_log("Error reading or parsing overlays.json: " . $e->getMessage());
		}
	} else {
		error_log("Error: overlays.json not found at path: " . $overlays_json_path);
	}
	$overlays_json = json_encode($overlays_data);
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
</head>
<body>
<div class="app-container d-flex flex-column vh-100">
	<!-- Top Toolbar (No changes needed here) -->
	<nav class="navbar navbar-expand-sm navbar-dark bg-dark top-toolbar">
		<div class="container-fluid" style="min-height:55px;">
			<span class="navbar-brand mb-0 h1">Designer</span>
			<div class="ms-auto d-flex align-items-center">
				<!-- File Menu -->
				<div class="dropdown me-2">
					<button class="btn btn-secondary btn-sm dropdown-toggle" type="button" id="fileMenuButton"
					        data-bs-toggle="dropdown" aria-expanded="false">
						<i class="fas fa-file"></i> File
					</button>
					<ul class="dropdown-menu dropdown-menu-end" style="z-index:9999" aria-labelledby="fileMenuButton">
						<li><a class="dropdown-item" href="#" id="loadDesign"><i class="fas fa-folder-open fa-fw me-2"></i>Load
								Design (.json)</a></li>
						<li><a class="dropdown-item" href="#" id="saveDesign"><i class="fas fa-save fa-fw me-2"></i>Save Design
								(.json)</a></li>
						<li>
							<hr class="dropdown-divider">
						</li>
						<li><a class="dropdown-item" href="#" id="exportPng"><i class="fas fa-image fa-fw me-2"></i>Export as
								PNG</a></li>
						<li><a class="dropdown-item" href="#" id="exportJpg"><i class="fas fa-image fa-fw me-2"></i>Export as
								JPG</a></li>
					</ul>
				</div>
				<input type="file" id="loadDesignInput" accept=".json" style="display: none;">
				<!-- History -->
				<button class="btn btn-outline-secondary btn-sm me-2" id="undoBtn" title="Undo"><i class="fas fa-undo"></i>
				</button>
				<button class="btn btn-outline-secondary btn-sm me-2" id="redoBtn" title="Redo"><i class="fas fa-redo"></i>
				</button>
				<!-- Layer Order & Actions -->
				<button class="btn btn-outline-secondary btn-sm me-1" id="sendToBackBtn" title="Send to Back"><i
						class="fas fa-angle-double-down"></i></button>
				<button class="btn btn-outline-secondary btn-sm me-2" id="bringToFrontBtn" title="Bring to Front"><i
						class="fas fa-angle-double-up"></i></button>
				<button class="btn btn-outline-danger btn-sm me-2" id="deleteBtn" title="Delete Selected"><i
						class="fas fa-trash"></i></button>
				<button class="btn btn-outline-secondary btn-sm me-2" id="lockBtn" title="Lock/Unlock Selected"><i
						class="fas fa-lock"></i></button>
				<!-- Download -->
				<button class="btn btn-primary btn-sm" id="downloadBtn" title="Download Image"><i class="fas fa-download"></i>
					Download
				</button>
			</div>
		</div>
	</nav>

	<!-- Main Content Area -->
	<div class="d-flex flex-grow-1 overflow-hidden main-content position-relative">

		<!-- Icon Bar (Fixed Width) -->
		<ul class="nav nav-pills flex-column text-center sidebar-nav flex-shrink-0">
			<li class="nav-item"><a class="nav-link" href="#" data-panel-target="#coversPanel" title="Covers"><i
						class="fas fa-book-open fa-lg"></i></a></li>
			<li class="nav-item"><a class="nav-link" href="#" data-panel-target="#templatesPanel" title="Templates"><i
						class="fas fa-th-large fa-lg"></i></a></li>
			<li class="nav-item"><a class="nav-link" href="#" data-panel-target="#elementsPanel" title="Elements"><i
						class="fas fa-shapes fa-lg"></i></a></li>
			<li class="nav-item"><a class="nav-link" href="#" data-panel-target="#overlaysPanel" title="Overlays"><i
						class="fas fa-clone fa-lg"></i></a></li>
			<li class="nav-item"><a class="nav-link" href="#" data-panel-target="#uploadPanel" title="Upload"><i
						class="fas fa-upload fa-lg"></i></a></li>
			<li class="nav-item"><a class="nav-link" href="#" data-panel-target="#layersPanel" title="Layers"><i
						class="fas fa-layer-group fa-lg"></i></a></li>
		</ul>

		<!-- Sliding Panels Container (Absolute Position) -->
		<div id="sidebar-panels-container" class="closed">
			<!-- Covers Panel -->
			<div id="coversPanel" class="sidebar-panel">
				<button type="button" class="btn-close close-panel-btn" aria-label="Close"></button>
				<div class="panel-content-wrapper"> <!-- Wrapper for padding/scroll -->
					<div class="panel-header"> <!-- Sticky Header -->
						<input type="search" id="coverSearch" class="form-control form-control-sm" placeholder="Search covers...">
					</div>
					<div id="coverList" class="item-grid panel-scrollable-content"><p>Loading covers...</p></div>
				</div>
			</div>

			<!-- Templates Panel -->
			<div id="templatesPanel" class="sidebar-panel">
				<button type="button" class="btn-close close-panel-btn" aria-label="Close"></button>
				<div class="panel-content-wrapper">
					<div class="panel-header">
						<input type="search" id="templateSearch" class="form-control form-control-sm" placeholder="Search templates...">
					</div>
					<div id="templateList" class="item-grid panel-scrollable-content"><p>Loading templates...</p></div>
				</div>
			</div>

			<!-- Elements Panel -->
			<div id="elementsPanel" class="sidebar-panel">
				<button type="button" class="btn-close close-panel-btn" aria-label="Close"></button>
				<div class="panel-content-wrapper">
					<div class="panel-header">
						<input type="search" id="elementSearch" class="form-control form-control-sm" placeholder="Search elements...">
					</div>
					<div id="elementList" class="item-grid panel-scrollable-content"><p>Loading elements...</p></div>
				</div>
			</div>

			<!-- Overlays Panel -->
			<div id="overlaysPanel" class="sidebar-panel">
				<button type="button" class="btn-close close-panel-btn" aria-label="Close"></button>
				<div class="panel-content-wrapper">
					<div class="panel-header"> <!-- Sticky Header -->
						<input type="search" id="overlaySearch" class="form-control form-control-sm"
						       placeholder="Search overlays...">
					</div>
					<div id="overlayList" class="item-grid panel-scrollable-content"><p>Loading overlays...</p></div>
				</div>
			</div>

			<!-- Upload Panel -->
			<div id="uploadPanel" class="sidebar-panel">
				<button type="button" class="btn-close close-panel-btn" aria-label="Close"></button>
				<div class="panel-content-wrapper">
					<div class="panel-header">Upload Image</div>
					<div class="panel-scrollable-content p-2"> <!-- Add padding here -->
						<input type="file" id="imageUploadInput" class="form-control form-control-sm mb-2" accept="image/*">
						<div id="uploadPreview" class="mt-2 text-center mb-2" style="min-height: 50px;"></div>
						<button id="addImageFromUpload" class="btn btn-primary btn-sm w-100" disabled>Add to Canvas</button>
					</div>
				</div>
			</div>

			<!-- Layers Panel -->
			<div id="layersPanel" class="sidebar-panel">
				<button type="button" class="btn-close close-panel-btn" aria-label="Close"></button>
				<div class="panel-content-wrapper">
					<div class="panel-header">Layers</div>
					<div class="panel-scrollable-content"> <!-- No extra padding needed for list -->
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
			<!-- Zoom Controls (No changes needed) -->
			<div id="zoom-controls" class="position-fixed rounded shadow-sm p-1 m-2 bg-dark d-flex align-items-center"
			     style="bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 1060;">
				<button id="zoom-out" class="btn btn-sm me-1" title="Zoom Out"><i class="fas fa-search-minus"></i></button>
				<div class="dropup mx-1">
					<button class="btn btn-sm dropdown-toggle zoom-percentage-display" type="button" id="zoom-percentage-toggle"
					        data-bs-toggle="dropdown" aria-expanded="false">
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
						<li>
							<hr class="dropdown-divider">
						</li>
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

<!-- Embed data (No changes needed) -->
<script id="templateData" type="application/json"><?php echo $templates_json; ?></script>
<script id="coverData" type="application/json"><?php echo $covers_json; ?></script>
<script id="elementData" type="application/json"><?php echo $elements_json; ?></script>
<script id="overlayData" type="application/json"><?php echo $overlays_json; ?></script>

<!-- Scripts (No changes needed in list) -->
<script src="vendors/bootstrap5.3.5/js/bootstrap.bundle.min.js"></script>
<script src="vendors/jquery-ui-1.14.1/external/jquery/jquery.js"></script>
<script src="vendors/jquery-ui-1.14.1/jquery-ui.min.js"></script>
<script src="vendors/jsfontpicker/dist/jquery.fontpicker.min.js"></script>
<script type="module" src="vendors/modern-screenshot.js"></script>
<script src="vendors/tinycolor-min.js"></script>
<script src="js/LayerManager.js"></script>
<script src="js/HistoryManager.js"></script>
<script src="js/CanvasManager.js"></script>
<script src="js/InspectorPanel.js"></script>
<script src="js/SidebarItemManager.js"></script>
<script src="js/App.js"></script>
</body>
</html>
