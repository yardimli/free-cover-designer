<?php
	// free-cover-designer/inspectorPanel.php
?>
<div id="inspectorPanel" class="inspector-panel closed">
	<button type="button" class="btn-close close-inspector-btn" aria-label="Close"></button>

	<!-- Layer Info & Actions -->
	<div id="inspector-layer-info-actions" class="inspector-section">
		<div class="section-header d-flex justify-content-between align-items-center"> <!-- Added flex for alignment -->
			<span id="inspector-layer-name" title="Layer Name" class="flex-grow-1 text-truncate me-2">No Layer Selected</span>
		</div>
		<div class="section-content">
			<div class="btn-group btn-group-sm w-100" role="group" aria-label="Layer Actions">
				<button type="button" class="btn btn-outline-secondary" id="lockBtn" title="Lock/Unlock Selected"><i class="fas fa-lock-open"></i></button>
				<button type="button" class="btn btn-outline-secondary" id="visibilityBtn" title="Toggle Visibility"><i class="fas fa-eye"></i></button>
				<button type="button" class="btn btn-outline-secondary" id="bringToFrontBtn" title="Bring to Front"><i class="fas fa-arrow-up"></i></button>
				<button type="button" class="btn btn-outline-secondary" id="sendToBackBtn" title="Send to Back"><i class="fas fa-arrow-down"></i></button>
				<button type="button" class="btn btn-outline-danger" id="deleteBtn" title="Delete Selected"><i class="fas fa-trash-alt"></i></button>
			</div>
		</div>
	</div>

	<!-- Alignment (Canvas) -->
	<div id="inspector-alignment" class="inspector-section">
		<div class="section-header">Align (Canvas)</div>
		<div class="section-content">
			<div class="btn-group btn-group-sm w-100 mb-1" role="group" aria-label="Horizontal Alignment">
				<button type="button" class="btn btn-outline-secondary" data-align-layer="left" title="Align Left"><i class="fas fa-align-left"></i></button>
				<button type="button" class="btn btn-outline-secondary" data-align-layer="h-center" title="Align Horizontal Center"><i class="fas fa-align-center"></i></button>
				<button type="button" class="btn btn-outline-secondary" data-align-layer="right" title="Align Right"><i class="fas fa-align-right"></i></button>
				<button type="button" class="btn btn-outline-secondary" data-align-layer="top" title="Align Top"><i class="fas fa-align-left fa-rotate-90"></i></button>
				<button type="button" class="btn btn-outline-secondary" data-align-layer="v-center" title="Align Vertical Center"><i class="fas fa-align-center fa-rotate-90"></i></button>
				<button type="button" class="btn btn-outline-secondary" data-align-layer="bottom" title="Align Bottom"><i class="fas fa-align-right fa-rotate-90"></i></button>
			</div>
		</div>
	</div>

	<!-- Layer Properties -->
	<div id="inspector-layer" class="inspector-section">
		<div class="section-header">Layer
			<button type="button" class="btn btn-outline-secondary btn-sm flex-shrink-0" id="cloneLayerBtn" title="Clone Layer" style="display: none;"><i class="fas fa-clone"></i> Clone Layer</button>
		</div>
		<div class="section-content">
			<!-- Opacity -->
			<div class="mb-2">
				<label for="inspector-opacity" class="form-label">Opacity</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-opacity" min="0" max="1" step="0.01" value="1">
					<span class="input-group-text opacity-label" id="inspector-opacity-value">100%</span>
				</div>
			</div>
			<!-- Rotation -->
			<div class="mb-2">
				<label for="inspector-rotation" class="form-label">Rotation</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-rotation" min="0" max="360" step="1" value="0">
					<span class="input-group-text opacity-label" id="inspector-rotation-value">0°</span>
				</div>
			</div>
			<!-- Scale -->
			<div class="mb-2">
				<label for="inspector-scale" class="form-label">Scale</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-scale" min="1" max="500" step="1" value="100">
					<span class="input-group-text opacity-label" id="inspector-scale-value">100%</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Text Properties -->
	<div id="inspector-text" class="inspector-section" style="display: none;">
		<div class="section-header">Text</div>
		<div class="section-content">
			<!-- Text Content -->
			<div class="mb-3">
				<label for="inspector-text-content" class="form-label">Content</label>
				<textarea id="inspector-text-content" class="form-control form-control-sm" rows="3"></textarea>
			</div>
			<!-- Font Family -->
			<div class="mb-3">
				<input type="text" id="inspector-font-family" class="form-control form-control-sm">
			</div>
			<!-- Font Size, Weight, Style -->
			<div class="row g-2 mb-3">
				<div class="col">
					<label for="inspector-font-size" class="form-label">Size</label>
					<input type="number" id="inspector-font-size" class="form-control form-control-sm" min="1" value="24">
				</div>
				<div class="col">
					<label class="form-label">Style</label>
					<div class="btn-group btn-group-sm w-100" role="group">
						<button type="button" id="inspector-bold-btn" class="btn btn-outline-secondary inspector-text-style-btn" title="Bold"><i class="fas fa-bold"></i></button>
						<button type="button" id="inspector-italic-btn" class="btn btn-outline-secondary inspector-text-style-btn" title="Italic"><i class="fas fa-italic"></i></button>
						<button type="button" id="inspector-underline-btn" class="btn btn-outline-secondary inspector-text-style-btn" title="Underline"><i class="fas fa-underline"></i></button>
					</div>
				</div>
			</div>
			<!-- Alignment (Horizontal & Vertical) -->
			<div class="row g-2 mb-3">
				<div class="col">
					<label class="form-label">Horiz Align</label>
					<div class="btn-group btn-group-sm w-100" role="group" aria-label="Horizontal text alignment" id="inspector-text-align">
						<button type="button" class="btn btn-outline-secondary" data-align="left" title="Align Left"><i class="fas fa-align-left"></i></button>
						<button type="button" class="btn btn-outline-secondary" data-align="center" title="Align Center"><i class="fas fa-align-center"></i></button>
						<button type="button" class="btn btn-outline-secondary" data-align="right" title="Align Right"><i class="fas fa-align-right"></i></button>
						<button type="button" class="btn btn-outline-secondary" data-align="justify" title="Align Justify"><i class="fas fa-align-justify"></i></button>
					</div>
				</div>
				<!-- START: New Vertical Alignment Buttons -->
				<div class="col">
					<label class="form-label">Vert Align</label>
					<div class="btn-group btn-group-sm w-100" role="group" aria-label="Vertical text alignment" id="inspector-text-v-align">
						<button type="button" class="btn btn-outline-secondary" data-align-v="flex-start" title="Align Top"><i class="fas fa-arrow-up"></i></button>
						<button type="button" class="btn btn-outline-secondary" data-align-v="center" title="Align Middle"><i class="fas fa-bars"></i></button> <!-- Using bars for middle -->
						<button type="button" class="btn btn-outline-secondary" data-align-v="flex-end" title="Align Bottom"><i class="fas fa-arrow-down"></i></button>
					</div>
				</div>
				<!-- END: New Vertical Alignment Buttons -->
			</div>
			<!-- Spacing -->
			<div class="row g-2 mb-3">
				<div class="col">
					<label for="inspector-letter-spacing" class="form-label">Letter Spacing</label>
					<input type="number" id="inspector-letter-spacing" class="form-control form-control-sm" step="0.1" value="0">
				</div>
				<div class="col">
					<label for="inspector-line-height" class="form-label">Line Height</label>
					<input type="number" id="inspector-line-height" class="form-control form-control-sm" step="0.1" min="0.5" value="1.3">
				</div>
			</div>
		</div>
	</div>

	<!-- Text Color -->
	<div id="inspector-color" class="inspector-section" style="display: none;">
		<div class="section-header">Color</div>
		<div class="section-content">
			<div class="color-input-group mb-2">
				<input type="color" class="form-control form-control-color me-2" id="inspector-fill-color" value="#000000" title="Fill Color">
				<div class="d-flex align-items-center">
					<span class="input-group-text">#</span>
					<input type="text" class="form-control" id="inspector-fill-hex" maxlength="6" placeholder="000000">
				</div>
			</div>
			<!-- Opacity for Fill (Handled by RGBA now, keep slider for potential future use or remove) -->
			<label for="inspector-fill-opacity" class="form-label visually-hidden">Fill Opacity</label>
			<div class="d-flex align-items-center visually-hidden">
				<input type="range" class="form-range flex-grow-1 me-2" id="inspector-fill-opacity" min="0" max="1" step="0.01" value="1">
				<span class="input-group-text opacity-label" id="inspector-fill-opacity-value">100%</span>
			</div>
		</div>
	</div>

	<!-- Text Border (Stroke) -->
	<div id="inspector-border" class="inspector-section" style="display: none;">
		<div class="section-header">Border (Stroke)</div>
		<div class="section-content">
			<!-- Border Color -->
			<div class="color-input-group mb-2">
				<input type="color" class="form-control form-control-color me-2" id="inspector-border-color" value="#000000" title="Border Color">
				<div class="d-flex align-items-center">
					<span class="input-group-text">#</span>
					<input type="text" class="form-control" id="inspector-border-hex" maxlength="6" placeholder="000000">
				</div>
			</div>
			<!-- Border Opacity (Handled by RGBA now) -->
			<label for="inspector-border-opacity" class="form-label visually-hidden">Border Opacity</label>
			<div class="d-flex align-items-center mb-2 visually-hidden">
				<input type="range" class="form-range flex-grow-1 me-2" id="inspector-border-opacity" min="0" max="1" step="0.01" value="1">
				<span class="input-group-text opacity-label" id="inspector-border-opacity-value">100%</span>
			</div>
			<!-- Border Weight -->
			<div class="mb-2">
				<label for="inspector-border-weight" class="form-label">Weight</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-border-weight" min="0" max="50" step="0.5" value="0">
					<span class="input-group-text opacity-label" id="inspector-border-weight-value">0</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Text Shading (Shadow) -->
	<div id="inspector-text-shading" class="inspector-section" style="display: none;">
		<div class="section-header">
			<span>Shading (Shadow)</span>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" role="switch" id="inspector-shading-enabled">
				<label class="form-check-label visually-hidden" for="inspector-shading-enabled">Enable Shading</label>
			</div>
		</div>
		<div class="section-content" style="display: none;">
			<!-- Shading Color -->
			<div class="color-input-group mb-2">
				<input type="color" class="form-control form-control-color me-2" id="inspector-shading-color" value="#000000" title="Shadow Color">
				<div class="d-flex align-items-center">
					<span class="input-group-text">#</span>
					<input type="text" class="form-control" id="inspector-shading-hex" maxlength="6" placeholder="000000">
				</div>
			</div>
			<!-- Shading Opacity (Handled by RGBA now) -->
			<label for="inspector-shading-opacity" class="form-label visually-hidden">Shadow Opacity</label>
			<div class="d-flex align-items-center mb-2 visually-hidden">
				<input type="range" class="form-range flex-grow-1 me-2" id="inspector-shading-opacity" min="0" max="1" step="0.01" value="0.5">
				<span class="input-group-text opacity-label" id="inspector-shading-opacity-value">50%</span>
			</div>
			<!-- Shading Blur -->
			<div class="mb-2">
				<label for="inspector-shading-blur" class="form-label">Blur</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-shading-blur" min="0" max="100" step="1" value="0">
					<span class="input-group-text opacity-label" id="inspector-shading-blur-value">0</span>
				</div>
			</div>
			<!-- Shading Offset -->
			<div class="mb-2">
				<label for="inspector-shading-offset" class="form-label">Offset</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-shading-offset" min="0" max="100" step="1" value="5">
					<span class="input-group-text opacity-label" id="inspector-shading-offset-value">5</span>
				</div>
			</div>
			<!-- Shading Angle -->
			<div class="mb-2">
				<label for="inspector-shading-angle" class="form-label">Angle</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-shading-angle" min="-180" max="180" step="1" value="45">
					<span class="input-group-text opacity-label" id="inspector-shading-angle-value">45</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Text Background -->
	<div id="inspector-text-background" class="inspector-section" style="display: none;">
		<div class="section-header">
			<span>Background</span>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" role="switch" id="inspector-background-enabled">
				<label class="form-check-label visually-hidden" for="inspector-background-enabled">Enable Background</label>
			</div>
		</div>
		<div class="section-content" style="display: none;">
			<!-- Background Color -->
			<div class="color-input-group mb-2">
				<input type="color" class="form-control form-control-color me-2" id="inspector-background-color" value="#FFFFFF" title="Background Color">
				<div class="d-flex align-items-center">
					<span class="input-group-text">#</span>
					<input type="text" class="form-control" id="inspector-background-hex" maxlength="6" placeholder="FFFFFF">
				</div>
			</div>
			<!-- Background Opacity -->
			<label for="inspector-background-opacity" class="form-label">Background Opacity</label>
			<div class="d-flex align-items-center mb-2">
				<input type="range" class="form-range flex-grow-1 me-2" id="inspector-background-opacity" min="0" max="1" step="0.01" value="1">
				<span class="input-group-text opacity-label" id="inspector-background-opacity-value">100%</span>
			</div>
			<!-- Background Padding -->
			<div class="mb-2">
				<label for="inspector-background-padding" class="form-label">Padding</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-background-padding" min="0" max="200" step="1" value="0">
					<span class="input-group-text opacity-label" id="inspector-background-padding-value">0</span>
				</div>
			</div>
			<!-- Background Corner Radius -->
			<div class="mb-2">
				<label for="inspector-background-radius" class="form-label">Corner Radius</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-background-radius" min="0" max="100" step="0.5" value="0">
					<span class="input-group-text opacity-label" id="inspector-background-radius-value">0</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Image Blend Mode -->
	<div id="inspector-image-blend-mode" class="inspector-section" style="display: none;">
		<div class="section-header">Blend Mode</div>
		<div class="section-content">
			<select id="inspector-blend-mode" class="form-select form-select-sm">
				<option value="normal">Normal</option>
				<option value="multiply">Multiply</option>
				<option value="screen">Screen</option>
				<option value="overlay">Overlay</option>
				<option value="darken">Darken</option>
				<option value="lighten">Lighten</option>
				<option value="color-dodge">Color Dodge</option>
				<option value="color-burn">Color Burn</option>
				<option value="hard-light">Hard Light</option>
				<option value="soft-light">Soft Light</option>
				<option value="difference">Difference</option>
				<option value="exclusion">Exclusion</option>
				<option value="hue">Hue</option>
				<option value="saturation">Saturation</option>
				<option value="color">Color</option>
				<option value="luminosity">Luminosity</option>
			</select>
		</div>
	</div>

	<!-- Image Filters -->
	<div id="inspector-image-filters" class="inspector-section" style="display: none;">
		<div class="section-header">Filters</div>
		<div class="section-content">
			<!-- Brightness -->
			<div class="mb-2">
				<label for="inspector-filter-brightness" class="form-label">Brightness</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-filter-brightness" min="0" max="200" step="1" value="100">
					<span class="input-group-text opacity-label" id="inspector-filter-brightness-value">100</span>
				</div>
			</div>
			<!-- Contrast -->
			<div class="mb-2">
				<label for="inspector-filter-contrast" class="form-label">Contrast</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-filter-contrast" min="0" max="200" step="1" value="100">
					<span class="input-group-text opacity-label" id="inspector-filter-contrast-value">100</span>
				</div>
			</div>
			<!-- Saturation -->
			<div class="mb-2">
				<label for="inspector-filter-saturation" class="form-label">Saturation</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-filter-saturation" min="0" max="200" step="1" value="100">
					<span class="input-group-text opacity-label" id="inspector-filter-saturation-value">100</span>
				</div>
			</div>
			<!-- Grayscale -->
			<div class="mb-2">
				<label for="inspector-filter-grayscale" class="form-label">Grayscale</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-filter-grayscale" min="0" max="100" step="1" value="0">
					<span class="input-group-text opacity-label" id="inspector-filter-grayscale-value">0</span>
				</div>
			</div>
			<!-- Sepia -->
			<div class="mb-2">
				<label for="inspector-filter-sepia" class="form-label">Sepia</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-filter-sepia" min="0" max="100" step="1" value="0">
					<span class="input-group-text opacity-label" id="inspector-filter-sepia-value">0</span>
				</div>
			</div>
			<!-- Hue Rotate -->
			<div class="mb-2">
				<label for="inspector-filter-hue-rotate" class="form-label">Hue Rotate</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-filter-hue-rotate" min="0" max="360" step="1" value="0">
					<span class="input-group-text opacity-label" id="inspector-filter-hue-rotate-value">0</span>
				</div>
			</div>
			<!-- Blur -->
			<div class="mb-2">
				<label for="inspector-filter-blur" class="form-label">Blur</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range flex-grow-1 me-2" id="inspector-filter-blur" min="0" max="20" step="0.1" value="0">
					<span class="input-group-text opacity-label" id="inspector-filter-blur-value">0.0</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Layer Definition -->
	<div id="inspector-definition" class="inspector-section">
		<div class="section-header">Definition</div>
		<div class="section-content">
		<select id="inspector-layer-definition" class="form-select form-select-sm">
			<option value="general">General</option>
			<option value="back_cover_text">Back Cover Text</option>
			<option value="back_cover_title">Back Cover Title</option>
			<option value="back_cover_image">Back Cover Image</option>
			<option value="spine_text">Spine Text</option>
			<option value="cover_title">Cover Title</option>
			<option value="cover_text">Cover Text</option>
			<option value="cover_image">Cover Image</option>
			<option value="cover_background">Cover Background</option>
		</select>
	</div>

</div>
