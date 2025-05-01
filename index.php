<?php
	// --- Template Scanning ---
	$template_dir = 'text-templates';
	$templates = [];
	$google_fonts_used = []; // <-- Store unique Google Fonts

	if (is_dir($template_dir)) {
		$files = scandir($template_dir);
		foreach ($files as $file) {
			if (pathinfo($file, PATHINFO_EXTENSION) === 'json') {
				$name = pathinfo($file, PATHINFO_FILENAME);
				$json_path = $template_dir . '/' . $file;
				$thumb_path = $template_dir . '/' . $name . '.png';

				// Check if thumbnail exists
				if (file_exists($thumb_path)) {
					$templates[] = [
						'name' => ucwords(str_replace(['-', '_'], ' ', $name)),
						'jsonPath' => $json_path,
						'thumbnailPath' => $thumb_path
					];

					// --- Scan JSON for Google Fonts ---
					try {
						$json_content = file_get_contents($json_path);
						$design_data = json_decode($json_content, true);
						if (isset($design_data['layers']) && is_array($design_data['layers'])) {
							foreach ($design_data['layers'] as $layer) {
								if (isset($layer['type']) && $layer['type'] === 'text' && !empty($layer['fontFamily'])) {
									$font_family = trim($layer['fontFamily'], " '\"");
									// Basic check: Avoid generic families and very common web-safe fonts
									$known_local = ['arial', 'verdana', 'times new roman', 'georgia', 'courier new', 'serif', 'sans-serif', 'monospace', 'helvetica neue'];
									if (!in_array(strtolower($font_family), $known_local) && !is_numeric($font_family)) {
										// Assume it might be a Google Font if not obviously local/generic
										if (!in_array($font_family, $google_fonts_used)) {
											$google_fonts_used[] = $font_family;
										}
									}
								}
							}
						}
					} catch (Exception $e) {
						// Ignore errors reading/parsing specific template JSONs for font scanning
						error_log("Error scanning font in $json_path: " . $e->getMessage());
					}
					// --- End Font Scan ---
				}
			}
		}
	}
	sort($google_fonts_used); // Optional: sort the font list
	$templates_json = json_encode($templates);
	$google_fonts_list_json = json_encode($google_fonts_used);


	// --- Cover Scanning ---
	// (Keep your existing cover scanning code here...)
	$covers_dir = 'covers';
	$covers_data = [];
	if (is_dir($covers_dir)) {
		$files = scandir($covers_dir);
		foreach ($files as $file) {
			// Check if the file ends with -preview.jpg
			if (str_ends_with(strtolower($file), '-preview.jpg')) {
				// Extract base name (remove -preview.jpg)
				$base_name = substr($file, 0, -12); // Length of '-preview.jpg' is 12
				// Construct paths
				$preview_path = $covers_dir . '/' . $file;
				$target_png_path = $covers_dir . '/' . $base_name . '.jpg';

				// Check if the corresponding .png file exists
				if (file_exists($target_png_path)) {
					$covers_data[] = [
						'name' => ucwords(str_replace(['-', '_'], ' ', $base_name)), // Make name prettier
						'thumbnailPath' => $preview_path, // Path to the preview JPG
						'imagePath' => $target_png_path   // Path to the target PNG
					];
				}
			}
		}
	}
	// Sort covers alphabetically by name (optional)
	usort($covers_data, function($a, $b) {
		return strcmp($a['name'], $b['name']);
	});
	$covers_json = json_encode($covers_data);
?>
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Book Cover Designer</title>
	<!-- Bootstrap CSS -->
	<link href="vendors/bootstrap5.3.5/css/bootstrap.min.css" rel="stylesheet">
	<!-- Font Awesome for Icons -->
	<link rel="stylesheet" href="vendors/fontawesome-free-6.7.2/css/all.min.css">
	<!-- jQuery UI CSS -->
	<link rel="stylesheet" href="vendors/jquery-ui-1.14.1/jquery-ui.css">
	<!-- jsFontPicker CSS -->
	<link rel="stylesheet" href="vendors/jsfontpicker/dist/jquery.fontpicker.css">  <!-- ADDED -->
	<!-- Custom CSS -->
	<link rel="stylesheet" href="css/style.css">

	<!-- Preconnect for Google Fonts -->
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

	<!-- Load Google Fonts found in templates -->
	<?php if (!empty($google_fonts_used)): ?>
		<?php
		// Prepare font families for URL, encoding each name
		$font_families_param = implode('|', array_map('urlencode', $google_fonts_used));
		// Request common weights/styles (adjust if needed)
		$google_font_url = "https://fonts.googleapis.com/css?family={$font_families_param}:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900&display=swap";
		?>
		<link href="<?php echo htmlspecialchars($google_font_url); ?>" rel="stylesheet"> <!-- UPDATED: Load all fonts in one link -->
	<?php endif; ?>

	<!-- Optional: Add other specific Google Fonts always needed -->
	<link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap" rel="stylesheet">

</head>
<body>
<div class="app-container d-flex flex-column vh-100">
	<!-- Top Toolbar -->
	<nav class="navbar navbar-expand-sm navbar-dark bg-dark top-toolbar">
		<div class="container-fluid" style="min-height:55px;">
			<span class="navbar-brand mb-0 h1">Designer</span>
			<!-- Text Editing Toolbar (Initially Hidden) -->
			<div id="textToolbar" class="bg-dark text-light p-2 d-none">
				<div class="d-flex flex-wrap align-items-center">
					<!-- Font Picker Input -->
					<input type="text" id="fontPickerInput" class="form-control form-control-sm me-2" placeholder="Font..." style="width: 180px;" title="Font Family"> <!-- REPLACED SELECT -->

					<input type="number" id="fontSizeInput" class="form-control form-control-sm me-2" value="16" min="1" max="500" style="width: 70px;">
					<input type="color" id="fontColorInput" class="form-control form-control-color form-control-sm me-2" value="#000000" title="Font Color">
					<button id="boldBtn" class="btn btn-outline-light btn-sm me-1" title="Bold"><i class="fas fa-bold"></i></button>
					<button id="italicBtn" class="btn btn-outline-light btn-sm me-1" title="Italic"><i class="fas fa-italic"></i></button>
					<button id="underlineBtn" class="btn btn-outline-light btn-sm me-1" title="Underline"><i class="fas fa-underline"></i></button>
					<div class="btn-group me-2">
						<button class="btn btn-outline-light btn-sm" data-align="left" title="Align Left"><i class="fas fa-align-left"></i></button>
						<button class="btn btn-outline-light btn-sm" data-align="center" title="Align Center"><i class="fas fa-align-center"></i></button>
						<button class="btn btn-outline-light btn-sm" data-align="right" title="Align Right"><i class="fas fa-align-right"></i></button>
						<button class="btn btn-outline-light btn-sm" data-align="justify" title="Align Justify"><i class="fas fa-align-justify"></i></button>
					</div>
					<button id="textEffectsBtn" class="btn btn-outline-light btn-sm me-1" title="Text Effects (Coming Soon)"><i class="fas fa-magic"></i></button>
				</div>
			</div>
			<!-- Rest of Top Toolbar -->
			<div class="ms-auto d-flex align-items-center">
				<!-- File Menu, Undo/Redo, Layer Order, Delete, Lock, Download Buttons -->
				<!-- (Keep existing buttons here) -->
				<div class="dropdown me-2">
					<button class="btn btn-secondary btn-sm dropdown-toggle" type="button" id="fileMenuButton" data-bs-toggle="dropdown" aria-expanded="false"> <i class="fas fa-file"></i> File </button>
					<ul class="dropdown-menu dropdown-menu-end" style="z-index:9999" aria-labelledby="fileMenuButton">
						<li><a class="dropdown-item" href="#" id="loadDesign"><i class="fas fa-folder-open fa-fw me-2"></i>Load Design (.json)</a></li>
						<li><a class="dropdown-item" href="#" id="saveDesign"><i class="fas fa-save fa-fw me-2"></i>Save Design (.json)</a></li>
						<li><hr class="dropdown-divider"></li>
						<li><a class="dropdown-item" href="#" id="exportPng"><i class="fas fa-image fa-fw me-2"></i>Export as PNG</a></li>
						<li><a class="dropdown-item" href="#" id="exportJpg"><i class="fas fa-image fa-fw me-2"></i>Export as JPG</a></li>
					</ul>
				</div>
				<input type="file" id="loadDesignInput" accept=".json" style="display: none;">
				<button class="btn btn-outline-secondary btn-sm me-2" id="undoBtn" title="Undo"><i class="fas fa-undo"></i></button>
				<button class="btn btn-outline-secondary btn-sm me-2" id="redoBtn" title="Redo"><i class="fas fa-redo"></i></button>
				<button class="btn btn-outline-secondary btn-sm me-1" id="sendToBackBtn" title="Send to Back"><i class="fas fa-angle-double-down"></i></button>
				<button class="btn btn-outline-secondary btn-sm me-2" id="bringToFrontBtn" title="Bring to Front"><i class="fas fa-angle-double-up"></i></button>
				<button class="btn btn-outline-danger btn-sm me-2" id="deleteBtn" title="Delete Selected"><i class="fas fa-trash"></i></button>
				<button class="btn btn-outline-secondary btn-sm me-2" id="lockBtn" title="Lock/Unlock Selected"><i class="fas fa-lock"></i></button>
				<button class="btn btn-primary btn-sm" id="downloadBtn" title="Download Image"><i class="fas fa-download"></i> Download</button>
			</div>
		</div>
	</nav>

	<!-- Main Content Area -->
	<div class="d-flex flex-grow-1 overflow-hidden main-content">
		<!-- Left Sidebar -->
		<!-- (Keep existing sidebar structure here) -->
		<div class="left-sidebar bg-light border-end d-flex">
			<ul class="nav nav-pills flex-column text-center sidebar-nav">
				<li class="nav-item"> <a class="nav-link active" data-bs-toggle="pill" href="#templatesPanel" title="Templates"><i class="fas fa-th-large fa-lg"></i></a> </li>
				<li class="nav-item"> <a class="nav-link" data-bs-toggle="pill" href="#coversPanel" title="Covers"><i class="fas fa-book-open fa-lg"></i></a> </li>
				<li class="nav-item"> <a class="nav-link" data-bs-toggle="pill" href="#elementsPanel" title="Elements"><i class="fas fa-shapes fa-lg"></i></a> </li>
				<li class="nav-item"> <a class="nav-link" data-bs-toggle="pill" href="#uploadPanel" title="Upload"><i class="fas fa-upload fa-lg"></i></a> </li>
				<li class="nav-item"> <a class="nav-link" data-bs-toggle="pill" href="#layersPanel" title="Layers"><i class="fas fa-layer-group fa-lg"></i></a> </li>
			</ul>
			<div class="tab-content flex-grow-1 overflow-auto sidebar-content">
				<!-- Templates Panel -->
				<div class="tab-pane fade show active" id="templatesPanel">
					<h6>Templates</h6>
					<div id="templateList" class="item-grid"> <p>Loading templates...</p> </div>
				</div>
				<!-- Covers Panel -->
				<div class="tab-pane fade" id="coversPanel">
					<h6>Covers</h6>
					<input type="search" id="coverSearch" class="form-control form-control-sm mb-2" placeholder="Search covers...">
					<div id="coverList" class="item-grid"> <p>Loading covers...</p> </div>
				</div>
				<!-- Elements Panel -->
				<div class="tab-pane fade" id="elementsPanel">
					<h6>Elements</h6>
					<div id="elementList" class="item-grid"> <p>Loading elements...</p> </div>
				</div>
				<!-- Upload Panel -->
				<div class="tab-pane fade" id="uploadPanel">
					<h6>Upload Image</h6>
					<input type="file" id="imageUploadInput" class="form-control form-control-sm" accept="image/*">
					<div id="uploadPreview" class="mt-2 text-center"></div>
					<button id="addImageFromUpload" class="btn btn-primary btn-sm mt-2 w-100" disabled>Add to Canvas</button>
				</div>
				<!-- Layers Panel -->
				<div class="tab-pane fade" id="layersPanel">
					<h6>Layers</h6>
					<ul id="layerList" class="list-group list-group-flush"> <li class="list-group-item text-muted">No layers yet.</li> </ul>
				</div>
			</div>
		</div>

		<!-- Canvas Area -->
		<!-- (Keep existing canvas structure and zoom controls here) -->
		<div id="canvas-area" class="text-center align-items-center bg-secondary overflow-auto position-relative">
			<div id="canvas-wrapper" class="position-relative">
				<div id="canvas" class="bg-white shadow position-relative">
				</div>
			</div>
			<div id="zoom-controls" class="position-fixed rounded shadow-sm p-1 m-2 bg-dark d-flex align-items-center" style="bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 1060;">
				<button id="zoom-out" class="btn btn-sm me-1" title="Zoom Out"><i class="fas fa-search-minus"></i></button>
				<div class="dropup mx-1">
					<button class="btn btn-sm dropdown-toggle zoom-percentage-display" type="button" id="zoom-percentage-toggle" data-bs-toggle="dropdown" aria-expanded="false"> 100% </button>
					<ul class="dropdown-menu dropdown-menu-dark" aria-labelledby="zoom-percentage-toggle" id="zoom-options-menu">
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="0.1">10%</a></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="0.25">25%</a></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="0.5">50%</a></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="0.75">75%</a></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="1.0">100%</a></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="1.5">150%</a></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="2.0">200%</a></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="3.0">300%</a></li>
						<li><hr class="dropdown-divider"></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="fit">Fit</a></li>
						<li><a class="dropdown-item zoom-option" href="#" data-zoom="1.0">Reset</a></li>
					</ul>
				</div>
				<button id="zoom-in" class="btn btn-sm ms-1" title="Zoom In"><i class="fas fa-search-plus"></i></button>
			</div>
		</div>
	</div>
</div>

<!-- Embed template data -->
<script id="templateData" type="application/json">
    <?php echo $templates_json; ?>
</script>
<!-- Embed cover data -->
<script id="coverData" type="application/json">
    <?php echo $covers_json; ?>
</script>
<!-- Embed Google Fonts list -->
<script id="googleFontsData" type="application/json">
    <?php echo $google_fonts_list_json; ?>
</script>

<!-- Scripts -->
<!-- Bootstrap Bundle with Popper -->
<script src="vendors/bootstrap5.3.5/js/bootstrap.bundle.min.js"></script>
<!-- jQuery -->
<script src="vendors/jquery-ui-1.14.1/external/jquery/jquery.js"></script>
<!-- jQuery UI -->
<script src="vendors/jquery-ui-1.14.1/jquery-ui.min.js"></script>
<!-- jsFontPicker -->
<script src="vendors/jsfontpicker/dist/jquery.fontpicker.min.js"></script> <!-- ADDED -->
<!-- html2canvas -->
<script src="vendors/html2canvas.min.js"></script>
<!-- Rulers Script -->
<script src="js/rulers.js"></script>
<!-- Class Files -->
<script src="js/LayerManager.js"></script>
<script src="js/HistoryManager.js"></script>
<script src="js/CanvasManager.js"></script>
<script src="js/TextToolbar.js"></script> <!-- Must be after fontpicker.js -->
<script src="js/SidebarItemManager.js"></script>
<!-- Main Application Logic -->
<script src="js/App.js"></script>

</body>
</html>
