<?php
	$template_dir = 'text-templates';
	$templates = [];
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
						'name' => ucwords(str_replace(['-', '_'], ' ', $name)), // Make name prettier
						'jsonPath' => $json_path,
						'thumbnailPath' => $thumb_path
					];
				}
			}
		}
	}
	// Encode the template data for JavaScript
	$templates_json = json_encode($templates);
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
	<!-- jQuery UI CSS (needed for draggable/resizable) -->
	<link rel="stylesheet" href="vendors/jquery-ui-1.14.1/jquery-ui.css">
	<!-- Custom CSS -->
	<link rel="stylesheet" href="css/style.css">
	<!-- Optional: Add Google Fonts used in templates -->
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Bentham&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Lato:wght@300;400;700&display=swap" rel="stylesheet">

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
					<select id="fontFamilySelect" class="form-select form-select-sm me-2" style="width: 150px;">
						<option>Arial</option>
						<option>Verdana</option>
						<option>Times New Roman</option>
						<option>Georgia</option>
						<option>Courier New</option>
						<option>serif</option>
						<option>sans-serif</option>
						<option>monospace</option>
						<option>'Playfair Display', serif</option>
						<option>'Lato', sans-serif</option>
						<option>'Bentham', serif</option> <!-- Add fonts from templates -->
						<option>'Helvetica Neue', sans-serif</option>
					</select>
					<input type="number" id="fontSizeInput" class="form-control form-control-sm me-2" value="16" min="1" max="500" style="width: 70px;">
					<input type="color" id="fontColorInput" class="form-control form-control-color form-control-sm me-2" value="#000000" title="Font Color">
					<button id="boldBtn" class="btn btn-outline-light btn-sm me-1" title="Bold"><i class="fas fa-bold"></i></button>
					<button id="italicBtn" class="btn btn-outline-light btn-sm me-1" title="Italic"><i class="fas fa-italic"></i></button>
					<button id="underlineBtn" class="btn btn-outline-light btn-sm me-1" title="Underline"><i class="fas fa-underline"></i></button>
					<div class="btn-group me-2">
						<button class="btn btn-outline-light btn-sm" data-align="left" title="Align Left"><i class="fas fa-align-left"></i></button>
						<button class="btn btn-outline-light btn-sm" data-align="center" title="Align Center"><i class="fas fa-align-center"></i></button>
						<button class="btn btn-outline-light btn-sm" data-align="right" title="Align Right"><i class="fas fa-align-right"></i></button>
						<button class="btn btn-outline-light btn-sm" data-align="justify" title="Align Justify"><i class="fas fa-align-justify"></i></button> <!-- Added Justify -->
					</div>
					<!-- Add More Controls Later (Line Height, Letter Spacing, Shadow etc.) -->
					<button id="textEffectsBtn" class="btn btn-outline-light btn-sm me-1" title="Text Effects (Coming Soon)"><i class="fas fa-magic"></i></button>
				</div>
			</div>

			<div class="ms-auto d-flex align-items-center">
				<div class="dropdown me-2">
					<button class="btn btn-secondary btn-sm dropdown-toggle" type="button" id="fileMenuButton" data-bs-toggle="dropdown" aria-expanded="false">
						<i class="fas fa-file"></i> File
					</button>
					<ul class="dropdown-menu dropdown-menu-end" style="z-index:9999" aria-labelledby="fileMenuButton"> <!-- Added dropdown-menu-end -->
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

				<!-- Layer Order Buttons -->
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
		<div class="left-sidebar bg-light border-end d-flex">
			<ul class="nav nav-pills flex-column text-center sidebar-nav">
				<li class="nav-item">
					<a class="nav-link active" data-bs-toggle="pill" href="#templatesPanel" title="Templates"><i class="fas fa-th-large fa-lg"></i></a> <!-- Changed href and title -->
				</li>
				<li class="nav-item">
					<a class="nav-link" data-bs-toggle="pill" href="#coversPanel" title="Covers"><i class="fas fa-book-open fa-lg"></i></a>
				</li>
				<li class="nav-item">
					<a class="nav-link" data-bs-toggle="pill" href="#elementsPanel" title="Elements"><i class="fas fa-shapes fa-lg"></i></a>
				</li>
				<li class="nav-item">
					<a class="nav-link" data-bs-toggle="pill" href="#uploadPanel" title="Upload"><i class="fas fa-upload fa-lg"></i></a>
				</li>
				<li class="nav-item">
					<a class="nav-link" data-bs-toggle="pill" href="#layersPanel" title="Layers"><i class="fas fa-layer-group fa-lg"></i></a>
				</li>
			</ul>
			<div class="tab-content flex-grow-1 overflow-auto p-2 sidebar-content">
				<!-- Templates Panel -->
				<div class="tab-pane fade show active" id="templatesPanel"> <!-- Changed ID -->
					<h6>Templates</h6> <!-- Changed Title -->
					<div id="templateList" class="item-grid"> <!-- Changed ID -->
						<!-- Template thumbnails will be loaded here by JS -->
						<p>Loading templates...</p>
					</div>
				</div>
				<!-- Covers Panel -->
				<div class="tab-pane fade" id="coversPanel">
					<h6>Covers</h6>
					<input type="search" id="coverSearch" class="form-control form-control-sm mb-2" placeholder="Search covers...">
					<div id="coverList" class="item-grid">
						<p>Loading covers...</p>
					</div>
				</div>
				<!-- Elements Panel -->
				<div class="tab-pane fade" id="elementsPanel">
					<h6>Elements</h6>
					<div id="elementList" class="item-grid">
						<p>Loading elements...</p>
					</div>
				</div>
				<!-- Upload Panel -->
				<div class="tab-pane fade" id="uploadPanel">
					<h6>Upload Image</h6>
					<input type="file" id="imageUploadInput" class="form-control form-control-sm" accept="image/*">
					<div id="uploadPreview" class="mt-2 text-center"></div> <!-- Added text-center -->
					<button id="addImageFromUpload" class="btn btn-primary btn-sm mt-2 w-100" disabled>Add to Canvas</button> <!-- Added w-100 -->
				</div>
				<!-- Layers Panel -->
				<div class="tab-pane fade" id="layersPanel">
					<h6>Layers</h6>
					<ul id="layerList" class="list-group list-group-flush">
						<li class="list-group-item text-muted">No layers yet.</li>
					</ul>
				</div>
			</div>
		</div>

		<!-- Canvas Area -->
		<div id="canvas-area" class="flex-grow-1 d-flex justify-content-center align-items-center bg-secondary overflow-auto position-relative">
			<!-- Canvas Wrapper (for positioning canvas relative to rulers) -->
			<div id="canvas-wrapper" class="position-relative"> <!-- Removed absolute, let flexbox center -->
				<div id="canvas" class="bg-white shadow position-relative"> <!-- Changed to relative -->
					<!-- Design elements go here -->
				</div>
			</div>
			<!-- Zoom Controls -->
			<div id="zoom-controls" class="position-fixed rounded shadow-sm p-1 m-2 bg-dark" style="bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 1060;"> <!-- Adjusted style -->
				<button id="zoom-out" class="btn btn-light btn-sm me-1" title="Zoom Out"><i class="fas fa-search-minus"></i></button>
				<span id="zoom-percentage" class="badge bg-dark align-middle text-light">100%</span> <!-- Added text-light -->
				<button id="zoom-in" class="btn btn-light btn-sm ms-1" title="Zoom In"><i class="fas fa-search-plus"></i></button>
			</div>
		</div>
	</div>
</div>

<!-- Embed template data for JavaScript -->
<script id="templateData" type="application/json">
        <?php echo $templates_json; ?>
    </script>

<!-- Bootstrap Bundle with Popper -->
<script src="vendors/bootstrap5.3.5/js/bootstrap.bundle.min.js"></script>
<!-- jQuery -->
<script src="vendors/jquery-ui-1.14.1/external/jquery/jquery.js"></script>
<!-- jQuery UI (Core, Widget, Mouse, Draggable, Resizable, Sortable) -->
<script src="vendors/jquery-ui-1.14.1/jquery-ui.min.js"></script>
<!-- html2canvas (for exporting) -->
<script src="vendors/html2canvas.min.js"></script>

<!-- Rulers Script -->
<script src="js/rulers.js"></script> <!-- Moved before App.js -->

<!-- New Class Files -->
<script src="js/LayerManager.js"></script>
<script src="js/HistoryManager.js"></script>
<script src="js/CanvasManager.js"></script>
<script src="js/TextToolbar.js"></script>
<script src="js/SidebarItemManager.js"></script>

<!-- Main Application Logic -->
<script src="js/App.js"></script>

</body>
</html>
