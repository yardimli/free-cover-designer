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
		<div class="modal-content modal-content-editor-theme">
			<div class="modal-header">
				<h5 class="modal-title" id="canvasSizeModalLabel">Set Canvas Dimensions</h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
			</div>
			<div class="modal-body">
				<div class="row">
					<!-- Controls Column -->
					<div class="col-md-7 col-12">
						<form id="canvasSizeForm">
							<!-- Unit Selection -->
							<div class="mb-2">
								<label class="form-label form-label-sm">Units:</label>
								<div class="form-check form-check-inline form-check-sm">
									<input class="form-check-input" type="radio" name="canvasUnit" id="unitInches" value="inches" checked>
									<label class="form-check-label" for="unitInches">Inches</label>
								</div>
								<div class="form-check form-check-inline form-check-sm">
									<input class="form-check-input" type="radio" name="canvasUnit" id="unitMillimeters" value="mm">
									<label class="form-check-label" for="unitMillimeters">Millimeters</label>
								</div>
							</div>

							<!-- Preset Size Selection -->
							<div class="mb-2">
								<label class="form-label form-label-sm">Preset Size (Front Cover)</label>
								<div id="canvasSizePresetGroup">
									<!-- Presets will be populated by JavaScript -->
								</div>
								<div class="invalid-feedback" id="presetError" style="display: none;">Please select a preset size.</div>
							</div>

							<!-- Custom Size Inputs (Initially Hidden) -->
							<div id="customSizeControls" class="mb-2" style="display: none;">
								<div class="row g-1">
									<div class="col-md-6">
										<label for="customWidthInput" class="form-label form-label-sm">Custom Width (<span id="customWidthUnit">inches</span>)</label>
										<input type="number" class="form-control form-control-sm" id="customWidthInput" value="6" min="0.1" step="0.01">
										<div class="invalid-feedback" id="customWidthError" style="display: none;">Enter a valid width.</div>
									</div>
									<div class="col-md-6">
										<label for="customHeightInput" class="form-label form-label-sm">Custom Height (<span id="customHeightUnit">inches</span>)</label>
										<input type="number" class="form-control form-control-sm" id="customHeightInput" value="9" min="0.1" step="0.01">
										<div class="invalid-feedback" id="customHeightError" style="display: none;">Enter a valid height.</div>
									</div>
								</div>
							</div>

							<!-- Spine and Back Cover Checkbox -->
							<div class="form-check form-check-sm mb-2" id="addSpineAndBackContainer">
								<input class="form-check-input" type="checkbox" value="" id="addSpineAndBackCheckbox">
								<label class="form-check-label" for="addSpineAndBackCheckbox">Add Spine & Back Cover</label>
							</div>

							<!-- Spine Controls (Initially Hidden or based on checkbox) -->
							<div id="spineControls" style="display: none;">
								<div class="mb-2">
									<label class="form-label form-label-sm">Spine Width Method:</label><br>
									<div class="form-check form-check-inline form-check-sm">
										<input class="form-check-input" type="radio" name="spineInputMethod" id="spineMethodPixels" value="pixels">
										<label class="form-check-label" for="spineMethodPixels">Enter Pixels</label>
									</div>
									<div class="form-check form-check-inline form-check-sm">
										<input class="form-check-input" type="radio" name="spineInputMethod" id="spineMethodCalculate" value="calculate" checked>
										<label class="form-check-label" for="spineMethodCalculate">Calculate from Pages</label>
									</div>
								</div>
								<div id="spinePixelInputContainer" class="mb-2">
									<label for="spineWidthInput" class="form-label form-label-sm">Spine Width (pixels)</label>
									<input type="number" class="form-control form-control-sm" id="spineWidthInput" value="200" min="1" step="1" max="1000">
									<div class="invalid-feedback" id="spineWidthError" style="display: none;">Please enter a valid positive number.</div>
								</div>
								<div id="spineCalculateInputContainer" class="mb-2" style="display: none;">
									<div class="row g-1">
										<div class="col-md-6">
											<label for="pageCountInput" class="form-label form-label-sm">Page Count</label>
											<input type="number" class="form-control form-control-sm" id="pageCountInput" value="200" min="1" step="1" max="1000">
											<div class="invalid-feedback" id="pageCountError" style="display: none;">Enter valid page count.</div>
										</div>
										<div class="col-md-6">
											<label for="paperTypeSelect" class="form-label form-label-sm">Paper Type</label>
											<select class="form-select form-select-sm" id="paperTypeSelect">
												<option value="bw">White</option>
												<option value="cream">Cream</option>
											</select>
										</div>
									</div>
									<div class="form-text text-muted mt-1" id="calculatedSpineInfo" style="display: none;"></div>
									<div class="invalid-feedback" id="spineCalculationError" style="display: none;">Could not calculate spine width. Check options.</div>
								</div>
							</div>
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
				<button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Cancel</button>
				<button type="button" class="btn btn-sm btn-primary" id="setCanvasSizeBtn">Apply Size</button>
			</div>
		</div>
	</div>
</div>
