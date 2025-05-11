<?php
	// free-cover-designer/canvasSizeModal.php

	$page_numbers_json_path = 'data/page-numbers.json';
	$page_numbers_data = [];
	if (file_exists($page_numbers_json_path)) {
		try {
			$json_content = file_get_contents($page_numbers_json_path);
			$decoded_data = json_decode($json_content, true);
			if (is_array($decoded_data)) {
				$page_numbers_data = $decoded_data;
			} else {
				error_log("Error: page-numbers.json did not decode into an array.");
			}
		} catch (Exception $e) {
			error_log("Error reading or parsing page-numbers.json: " . $e->getMessage());
		}
	} else {
		error_log("Error: page-numbers.json not found at path: " . $page_numbers_json_path);
	}
	$page_numbers_json = json_encode($page_numbers_data);
?>
<script id="pageNumberData" type="application/json"><?php echo $page_numbers_json; ?></script>

<div class="modal fade" id="canvasSizeModal" tabindex="-1" aria-labelledby="canvasSizeModalLabel" aria-hidden="true">
	<div class="modal-dialog modal-lg">
		<div class="modal-content modal-content-editor-theme"> <?php // Added custom class ?>
			<div class="modal-header">
				<h5 class="modal-title" id="canvasSizeModalLabel">Set Canvas Dimensions</h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
			</div>
			<div class="modal-body">
				<div class="row">
					<!-- Controls Column -->
					<div class="col-md-7 col-12">
						<form id="canvasSizeForm">
							<div class="mb-2"> <?php // Reduced margin ?>
								<label class="form-label form-label-sm">Preset Size (Front Cover)</label> <?php // Smaller label ?>
								<div id="canvasSizePresetGroup">
									<?php
										$presets = [
											"1600x2560" => ["label" => "Kindle (1600 x 2560 px)", "base_size" => "kindle"],
											"1540x2475" => ["label" => "5.00\" x 8.00\" (1540 x 2475 px)", "base_size" => "5.00x8.00"],
											"1615x2475" => ["label" => "5.25\" x 8.00\" (1615 x 2475 px)", "base_size" => "5.25x8.00"],
											"1690x2625" => ["label" => "5.50\" x 8.50\" (1690 x 2625 px)", "base_size" => "5.50x8.50"],
											"1840x2775" => ["label" => "6.00\" x 9.00\" (1840 x 2775 px)", "base_size" => "6.00x9.00"],
											"1882x2838" => ["label" => "6.14\" x 9.21\" (1882 x 2838 px)", "base_size" => "6.14x9.21"],
											"2048x2958" => ["label" => "6.69\" x 9.61\" (2048 x 2958 px)", "base_size" => "6.69x9.61"],
											"3000x3000" => ["label" => "Square (3000 x 3000 px)", "base_size" => "square"]
										];
										foreach ($presets as $value => $details) {
											$id = "preset_" . str_replace(['x', '"', '.', ' '], ['', '', '', ''], $value);
											echo '<div class="form-check form-check-sm mb-1">'; // Smaller check, reduced margin
											echo '<input class="form-check-input" type="radio" name="canvasSizePreset" id="' . $id . '" value="' . $value . '" data-base-size="' . htmlspecialchars($details['base_size']) . '" required>';
											echo '<label class="form-check-label" for="' . $id . '">' . $details['label'] . '</label>';
											echo '</div>';
										}
									?>
								</div>
								<div class="invalid-feedback" id="presetError" style="display: none;">Please select a preset size.</div>
							</div>

							<div class="form-check form-check-sm mb-2"> <?php // Smaller check, reduced margin ?>
								<input class="form-check-input" type="checkbox" value="" id="addSpineAndBackCheckbox"> <?php // CHANGED ID ?>
								<label class="form-check-label" for="addSpineAndBackCheckbox"> Add Spine & Back Cover </label> <?php // CHANGED Label ?>
							</div>

							<div id="spineControls" style="display: none;">
								<!-- Spine Input Method Selection -->
								<div class="mb-2"> <?php // Reduced margin ?>
									<label class="form-label form-label-sm">Spine Width Method:</label> <?php // Smaller label ?>
									<br>
									<div class="form-check form-check-inline form-check-sm"> <?php // Smaller check ?>
										<input class="form-check-input" type="radio" name="spineInputMethod" id="spineMethodPixels" value="pixels">
										<label class="form-check-label" for="spineMethodPixels">Enter Pixels</label>
									</div>
									<div class="form-check form-check-inline form-check-sm"> <?php // Smaller check ?>
										<input class="form-check-input" type="radio" name="spineInputMethod" id="spineMethodCalculate" value="calculate" checked>
										<label class="form-check-label" for="spineMethodCalculate">Calculate from Pages</label>
									</div>
								</div>

								<!-- Pixel Input Container -->
								<div id="spinePixelInputContainer" class="mb-2"> <?php // Reduced margin ?>
									<label for="spineWidthInput" class="form-label form-label-sm">Spine Width (pixels)</label> <?php // Smaller label ?>
									<input type="number" class="form-control form-control-sm" id="spineWidthInput" value="200" min="1" step="1" max="500">
									<div class="invalid-feedback" id="spineWidthError" style="display: none;">Please enter a valid positive number.</div>
								</div>

								<!-- Calculation Input Container -->
								<div id="spineCalculateInputContainer" class="mb-2" style="display: none;"> <?php // Reduced margin ?>
									<div class="row g-1"> <?php // Reduced gutter ?>
										<div class="col-md-6">
											<label for="pageCountInput" class="form-label form-label-sm">Page Count</label> <?php // Smaller label ?>
											<input type="number" class="form-control form-control-sm" id="pageCountInput" value="200" min="1" step="1" max="1000">
											<div class="invalid-feedback" id="pageCountError" style="display: none;">Enter valid page count.</div>
										</div>
										<div class="col-md-6">
											<label for="paperTypeSelect" class="form-label form-label-sm">Paper Type</label> <?php // Smaller label ?>
											<select class="form-select form-select-sm" id="paperTypeSelect">
												<option value="bw">White</option>
												<option value="cream">Cream</option>
											</select>
										</div>
									</div>
									<div class="form-text text-muted mt-1" id="calculatedSpineInfo" style="display: none;"></div>
									<div class="invalid-feedback" id="spineCalculationError" style="display: none;">Could not calculate spine width. Check options.</div>
								</div>
							</div> <!-- End spineControls -->
						</form>
					</div>

					<!-- Preview Column -->
					<div class="col-md-5 d-none-sm d-md-flex align-items-center justify-content-center mb-2 mb-md-0" id="canvasPreviewContainer">
						<div id="canvasPreviewArea">
							<div id="previewBack">Back</div>
							<div id="previewSpine">Spine</div>
							<div id="previewFront">Front</div>
						</div>
					</div>
				</div>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Cancel</button> <?php // Smaller button ?>
				<button type="button" class="btn btn-sm btn-primary" id="setCanvasSizeBtn">Apply Size</button> <?php // Smaller button ?>
			</div>
		</div>
	</div>
</div>
