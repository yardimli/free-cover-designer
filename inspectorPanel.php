<div id="inspectorPanel" class="inspector-panel d-none">

	<div class="inspector-section" id="inspector-alignment">
		<h6 class="section-header">Alignment</h6>
		<div class="section-content d-flex justify-content-between alignment-icons">
			<button class="btn btn-outline-secondary btn-sm" data-align-layer="left" title="Align Left"><i class="fas fa-align-left"></i></button>
			<button class="btn btn-outline-secondary btn-sm" data-align-layer="h-center" title="Align Horizontal Center"><i class="fas fa-align-center"></i></button>
			<button class="btn btn-outline-secondary btn-sm" data-align-layer="right" title="Align Right"><i class="fas fa-align-right"></i></button>
			<button class="btn btn-outline-secondary btn-sm" data-align-layer="top" title="Align Top"><i class="fas fa-align-left fa-rotate-90"></i></button>
			<button class="btn btn-outline-secondary btn-sm" data-align-layer="v-center" title="Align Vertical Center"><i class="fas fa-align-center fa-rotate-90"></i></button>
			<button class="btn btn-outline-secondary btn-sm" data-align-layer="bottom" title="Align Bottom"><i class="fas fa-align-left fa-rotate-270"></i></button>
		</div>
	</div>

	<div class="inspector-section" id="inspector-layer">
		<h6 class="section-header">Layer</h6>
		<div class="section-content">
			<label for="inspector-opacity" class="form-label">Opacity</label>
			<div class="d-flex align-items-center">
				<input type="range" class="form-range" id="inspector-opacity" min="0" max="1" step="0.01" value="1">
				<span class="ms-2 opacity-label" id="inspector-opacity-value">100%</span>
			</div>
		</div>
	</div>

	<div class="inspector-section" id="inspector-color">
		<h6 class="section-header">Color</h6>
		<div class="section-content">
			<div class="color-input-group">
				<input type="color" class="form-control form-control-color inspector-color-picker" id="inspector-fill-color" value="#FFFFFF">
				<input type="text" class="form-control form-control-sm inspector-color-hex" id="inspector-fill-hex" value="FFFFFF">
				<span class="ms-2 opacity-label" id="inspector-fill-opacity-value">100%</span>
			</div>
			<input type="range" class="form-range mt-1" id="inspector-fill-opacity" min="0" max="1" step="0.01" value="1">
		</div>
	</div>

	<div class="inspector-section" id="inspector-border">
		<h6 class="section-header">
			<span>Border</span>
			<button class="btn btn-sm p-0 border-0 text-secondary" id="inspector-border-toggle" title="Toggle Border"><i class="far fa-square"></i></button>
		</h6>
		<div class="section-content">
			<div class="color-input-group mb-2">
				<input type="color" class="form-control form-control-color inspector-color-picker" id="inspector-border-color" value="#000000">
				<input type="text" class="form-control form-control-sm inspector-color-hex" id="inspector-border-hex" value="000000">
				<span class="ms-2 opacity-label" id="inspector-border-opacity-value">100%</span>
			</div>
			<input type="range" class="form-range mt-1 mb-2" id="inspector-border-opacity" min="0" max="1" step="0.01" value="1">

			<label for="inspector-border-weight" class="form-label">Border Weight</label>
			<div class="d-flex align-items-center">
				<input type="range" class="form-range" id="inspector-border-weight" min="0" max="50" step="0.5" value="0">
				<span class="ms-2 opacity-label" id="inspector-border-weight-value">0</span>
			</div>
		</div>
	</div>

	<div class="inspector-section" id="inspector-text">
		<h6 class="section-header">Text</h6>
		<div class="section-content">
			<div class="mb-2">
				<label for="inspector-text-content" class="form-label">Content</label>
				<textarea id="inspector-text-content" class="form-control form-control-sm" rows="4" placeholder="Enter text..."></textarea>
			</div>

			<!-- Font Picker -->
			<div class="mb-2">
				<input type="text" id="inspector-font-family" class="form-control form-control-sm font-picker" placeholder="Select Font...">
			</div>
			<!-- Size, Weight, Style, Deco -->
			<div class="row gx-2 mb-2">
				<div class="col">
					<label for="inspector-font-size" class="form-label">Size</label>
					<div class="input-group input-group-sm">
						<input type="number" id="inspector-font-size" class="form-control" value="24" min="1" step="1">
						<span class="input-group-text">px</span>
					</div>
				</div>
				<div class="col-auto d-flex align-items-end">
					<div class="btn-group btn-group-sm">
						<button id="inspector-bold-btn" class="btn btn-outline-secondary inspector-text-style-btn" title="Bold"><i class="fas fa-bold"></i></button>
						<button id="inspector-italic-btn" class="btn btn-outline-secondary inspector-text-style-btn" title="Italic"><i class="fas fa-italic"></i></button>
						<button id="inspector-underline-btn" class="btn btn-outline-secondary inspector-text-style-btn" title="Underline"><i class="fas fa-underline"></i></button>
					</div>
				</div>
			</div>

			<!-- Spacing (Letter, Line) -->
			<div class="row gx-2 mb-2">
				<div class="col">
					<label for="inspector-letter-spacing" class="form-label">Spacing</label>
					<div class="input-group input-group-sm">
						<span class="input-group-text"><i class="fas fa-text-width"></i></span>
						<input type="number" id="inspector-letter-spacing" class="form-control" value="0" step="0.1">
					</div>
				</div>
				<div class="col">
					<label for="inspector-line-height" class="form-label">Line Height</label>
					<div class="input-group input-group-sm">
						<span class="input-group-text"><i class="fas fa-text-height"></i></span>
						<input type="number" id="inspector-line-height" class="form-control" value="1.3" step="0.01" min="0.5">
					</div>
				</div>
			</div>

			<!-- Text Alignment -->
			<div class="mb-2">
				<label class="form-label">Align</label>
				<div class="btn-group d-flex" role="group" id="inspector-text-align">
					<button type="button" class="btn btn-outline-secondary btn-sm" data-align="left" title="Align Left"><i class="fas fa-align-left"></i></button>
					<button type="button" class="btn btn-outline-secondary btn-sm" data-align="center" title="Align Center"><i class="fas fa-align-center"></i></button>
					<button type="button" class="btn btn-outline-secondary btn-sm" data-align="right" title="Align Right"><i class="fas fa-align-right"></i></button>
					<button type="button" class="btn btn-outline-secondary btn-sm" data-align="justify" title="Align Justify"><i class="fas fa-align-justify"></i></button>
				</div>
			</div>
		</div>
	</div>

	<div class="inspector-section" id="inspector-text-shading">
		<h6 class="section-header">
			<span>Text Shading</span>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" role="switch" id="inspector-shading-enabled">
			</div>
		</h6>
		<div class="section-content">
			<!-- Shading Color -->
			<label class="form-label">Color</label>
			<div class="color-input-group mb-2">
				<input type="color" class="form-control form-control-color inspector-color-picker" id="inspector-shading-color" value="#000000">
				<input type="text" class="form-control form-control-sm inspector-color-hex" id="inspector-shading-hex" value="000000">
				<span class="ms-2 opacity-label" id="inspector-shading-opacity-value">50%</span>
			</div>
			<input type="range" class="form-range mt-1 mb-2" id="inspector-shading-opacity" min="0" max="1" step="0.01" value="0.5">

			<!-- Offset -->
			<div class="mb-2">
				<label for="inspector-shading-offset" class="form-label">Offset</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range" id="inspector-shading-offset" min="0" max="100" step="1" value="5">
					<span class="ms-2 opacity-label" id="inspector-shading-offset-value">5</span>
				</div>
			</div>

			<!-- Angle -->
			<div class="mb-2">
				<label for="inspector-shading-angle" class="form-label">Angle</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range" id="inspector-shading-angle" min="-180" max="180" step="1" value="-90">
					<span class="ms-2 opacity-label" id="inspector-shading-angle-value">-90</span>
				</div>
			</div>
			<!-- Blur -->
			<div class="mb-2">
				<label for="inspector-shading-blur" class="form-label">Blur</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range" id="inspector-shading-blur" min="0" max="100" step="1" value="10">
					<span class="ms-2 opacity-label" id="inspector-shading-blur-value">10</span>
				</div>
			</div>
		</div>
	</div>

	<div class="inspector-section" id="inspector-text-background">
		<h6 class="section-header">
			<span>Background</span>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" role="switch" id="inspector-background-enabled">
			</div>
		</h6>
		<div class="section-content">
			<!-- Background Color -->
			<label class="form-label">Color</label>
			<div class="color-input-group mb-2">
				<input type="color" class="form-control form-control-color inspector-color-picker" id="inspector-background-color" value="#FFFFFF">
				<input type="text" class="form-control form-control-sm inspector-color-hex" id="inspector-background-hex" value="FFFFFF">
				<span class="ms-2 opacity-label" id="inspector-background-opacity-value">100%</span>
			</div>
			<input type="range" class="form-range mt-1 mb-2" id="inspector-background-opacity" min="0" max="1" step="0.01" value="1">

			<!-- Background Padding -->
			<div class="mb-2">
				<label for="inspector-background-padding" class="form-label">Padding</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range" id="inspector-background-padding" min="0" max="200" step="0" value="0">
					<span class="ms-2 opacity-label" id="inspector-background-padding-value">0</span>
				</div>
			</div>

			<!-- Corner Radius -->
			<div class="mb-2">
				<label for="inspector-background-radius" class="form-label">Corner Radius</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range" id="inspector-background-radius" min="0" max="100" step="0.5" value="0">
					<span class="ms-2 opacity-label" id="inspector-background-radius-value">100</span>
				</div>
			</div>

		</div>
	</div>

	<!-- Image Filters Section -->
	<div class="inspector-section" id="inspector-image-filters" style="display: none;"> <!-- Initially hidden -->
		<h6 class="section-header">Image Filters</h6>
		<div class="section-content">

			<!-- Brightness -->
			<div class="mb-2">
				<label for="inspector-filter-brightness" class="form-label">Brightness</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range" id="inspector-filter-brightness" min="0" max="200" step="1" value="100">
					<span class="ms-2 text-nowrap" id="inspector-filter-brightness-value" style="min-width: 45px; text-align: right;">100%</span>
				</div>
			</div>

			<!-- Contrast -->
			<div class="mb-2">
				<label for="inspector-filter-contrast" class="form-label">Contrast</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range" id="inspector-filter-contrast" min="0" max="200" step="1" value="100">
					<span class="ms-2 text-nowrap" id="inspector-filter-contrast-value" style="min-width: 45px; text-align: right;">100%</span>
				</div>
			</div>

			<!-- Saturation -->
			<div class="mb-2">
				<label for="inspector-filter-saturation" class="form-label">Saturation</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range" id="inspector-filter-saturation" min="0" max="200" step="1" value="100">
					<span class="ms-2 text-nowrap" id="inspector-filter-saturation-value" style="min-width: 45px; text-align: right;">100%</span>
				</div>
			</div>

			<!-- Grayscale -->
			<div class="mb-2">
				<label for="inspector-filter-grayscale" class="form-label">Grayscale</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range" id="inspector-filter-grayscale" min="0" max="100" step="1" value="0">
					<span class="ms-2 text-nowrap" id="inspector-filter-grayscale-value" style="min-width: 45px; text-align: right;">0%</span>
				</div>
			</div>

			<!-- Sepia -->
			<div class="mb-2">
				<label for="inspector-filter-sepia" class="form-label">Sepia</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range" id="inspector-filter-sepia" min="0" max="100" step="1" value="0">
					<span class="ms-2 text-nowrap" id="inspector-filter-sepia-value" style="min-width: 45px; text-align: right;">0%</span>
				</div>
			</div>

			<!-- Hue Rotate -->
			<div class="mb-2">
				<label for="inspector-filter-hue-rotate" class="form-label">Hue Rotate</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range" id="inspector-filter-hue-rotate" min="0" max="360" step="1" value="0">
					<span class="ms-2 text-nowrap" id="inspector-filter-hue-rotate-value" style="min-width: 45px; text-align: right;">0deg</span>
				</div>
			</div>

			<!-- Blur -->
			<div class="mb-2">
				<label for="inspector-filter-blur" class="form-label">Blur</label>
				<div class="d-flex align-items-center">
					<input type="range" class="form-range" id="inspector-filter-blur" min="0" max="20" step="0.1" value="0">
					<span class="ms-2 text-nowrap" id="inspector-filter-blur-value" style="min-width: 45px; text-align: right;">0px</span>
				</div>
			</div>

		</div>
	</div>

	<!-- NEW: Blend Mode Section -->
	<div class="inspector-section" id="inspector-image-blend-mode" style="display: none;"> <!-- Initially hidden -->
		<h6 class="section-header">Blend Mode</h6>
		<div class="section-content">
			<select class="form-select form-select-sm" id="inspector-blend-mode">
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

</div>
