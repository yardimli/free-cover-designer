<?php
	set_time_limit(30000); // Increased time limit

	require 'vendor/autoload.php'; // If using Dotenv
	$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
	$dotenv->load();
	if (empty($_ENV['OPEN_AI_API_KEY'])) {
		die("Error: OPEN_AI_API_KEY environment variable not set.");
	}

// --- Configuration ---
	$sourceDir = 'overlays';       // Input directory with PNGs (and subfolders)
	$outputDir = 'new-overlays';   // Output directory for processed files
	$resultsFile = 'data/overlays.json'; // Results JSON file name
	$thumbnailWidth = 512;         // Width for the generated thumbnails
// --- End Configuration ---

// --- Helper Functions ---

	function local_log($message)
	{
		$logFile = 'error_log.txt'; // Specify your log file
		file_put_contents($logFile, date('Y-m-d H:i:s') . " - " . $message . PHP_EOL, FILE_APPEND);
	}

// Check if GD library is installed
	if (!extension_loaded('gd') || !function_exists('gd_info')) {
		$errorMsg = "Error: The GD library extension is required for image processing but is not enabled. Please enable it in your php.ini.";
		local_log($errorMsg);
		die($errorMsg);
	}

	/**
	 * Creates a JPG thumbnail from a source image file.
	 *
	 * @param string $sourcePath Full path to the source image (PNG, JPG, GIF).
	 * @param string $destinationPath Full path to save the JPG thumbnail.
	 * @param int $targetWidth The desired width of the thumbnail.
	 * @param int $quality JPG quality (0-100).
	 * @return bool True on success, false on failure.
	 */
	function create_thumbnail($sourcePath, $destinationPath, $targetWidth, $quality = 85)
	{
		try {
			$imageInfo = @getimagesize($sourcePath);
			if (!$imageInfo) {
				local_log("Failed to get image size for: " . $sourcePath);
				return false;
			}

			$mime = $imageInfo['mime'];
			$originalWidth = $imageInfo[0];
			$originalHeight = $imageInfo[1];

			// Calculate thumbnail height maintaining aspect ratio
			$aspectRatio = $originalHeight / $originalWidth;
			$targetHeight = round($targetWidth * $aspectRatio);

			// Load the source image
			$sourceImage = null;
			switch ($mime) {
				case 'image/png':
					$sourceImage = @imagecreatefrompng($sourcePath);
					break;
				case 'image/jpeg':
					$sourceImage = @imagecreatefromjpeg($sourcePath);
					break;
				case 'image/gif':
					$sourceImage = @imagecreatefromgif($sourcePath);
					break;
				default:
					local_log("Unsupported image type ($mime) for thumbnail creation: " . $sourcePath);
					return false;
			}

			if (!$sourceImage) {
				local_log("Failed to create image resource from: " . $sourcePath);
				return false;
			}

			// Create the thumbnail canvas (true color)
			$thumbnail = imagecreatetruecolor($targetWidth, $targetHeight);
			if (!$thumbnail) {
				local_log("Failed to create true color image canvas for thumbnail.");
				imagedestroy($sourceImage);
				return false;
			}

			// Handle transparency for PNGs - fill background with white for JPG output
			if ($mime == 'image/png') {
				imagealphablending($thumbnail, false);
				imagesavealpha($thumbnail, true);
				$transparent = imagecolorallocatealpha($thumbnail, 255, 255, 255, 127); // Fully transparent - might not be needed if filling bg
				$white = imagecolorallocate($thumbnail, 255, 255, 255); // White background
				imagefilledrectangle($thumbnail, 0, 0, $targetWidth, $targetHeight, $white);
				imagealphablending($thumbnail, true); // Re-enable blending for the copy
			}


			// Resize and copy the original image to the thumbnail canvas
			if (!imagecopyresampled(
				$thumbnail,
				$sourceImage,
				0, 0, 0, 0, // Dst (x,y), Src (x,y)
				$targetWidth, $targetHeight,
				$originalWidth, $originalHeight
			)) {
				local_log("Failed imagecopyresampled for: " . $sourcePath);
				imagedestroy($sourceImage);
				imagedestroy($thumbnail);
				return false;
			}


			// Save the thumbnail as JPG
			if (!imagejpeg($thumbnail, $destinationPath, $quality)) {
				local_log("Failed to save JPG thumbnail to: " . $destinationPath);
				imagedestroy($sourceImage);
				imagedestroy($thumbnail);
				return false;
			}

			// Clean up resources
			imagedestroy($sourceImage);
			imagedestroy($thumbnail);

			return true;

		} catch (Exception $e) {
			local_log("Exception during thumbnail creation for $sourcePath: " . $e->getMessage());
			// Ensure resources are freed even if an exception occurs mid-process
			if (isset($sourceImage) && is_resource($sourceImage)) imagedestroy($sourceImage);
			if (isset($thumbnail) && is_resource($thumbnail)) imagedestroy($thumbnail);
			return false;
		}
	}


	function call_openAI_question($messages, $temperature, $max_tokens, $model = 'gpt-4o-mini')
	{
		// --- (Keep your existing call_openAI_question function here) ---
		// No changes needed in this function itself based on the new requirements.
		// It already handles API key checks, JSON encoding/decoding, cURL requests,
		// and error handling for the API call.
		if (empty($_ENV['OPEN_AI_API_KEY'])) {
			local_log("OpenAI API Key is missing.");
			return "Error: API Key missing."; // Return an error message
		}

		$data = array(
			'model' => $model,
			'messages' => $messages,
			'temperature' => (float)$temperature, // Ensure float type
			'max_tokens' => (int)$max_tokens,   // Ensure int type
			'top_p' => 1,
			'frequency_penalty' => 0,
			'presence_penalty' => 0,
			'n' => 1,
			'stream' => false,
		);

		$post_json = json_encode($data);
		if (json_last_error() !== JSON_ERROR_NONE) {
			local_log("JSON Encode Error: " . json_last_error_msg());
			return "Error: Could not encode data for API.";
		}

		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, 'https://api.openai.com/v1/chat/completions');
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
		curl_setopt($ch, CURLOPT_POST, 1);
		curl_setopt($ch, CURLOPT_POSTFIELDS, $post_json);
		curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 20); // Connection timeout
		curl_setopt($ch, CURLOPT_TIMEOUT, 120); // Request timeout (adjust as needed)

		curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
		curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);


		$headers = array();
		$headers[] = 'Content-Type: application/json';
		$headers[] = "Authorization: Bearer " . $_ENV['OPEN_AI_API_KEY'];
		curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

		$result = curl_exec($ch);

		if (curl_errno($ch)) {
			$error_msg = curl_error($ch);
			curl_close($ch);
			local_log("cURL Error: " . $error_msg);
			return "Error: API request failed (cURL: " . $error_msg . ")";
		}

		$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		curl_close($ch);

		if ($http_code >= 400) {
			local_log("API Error: HTTP Code " . $http_code . " Response: " . $result);
			// Attempt to decode error message from OpenAI
			$error_data = json_decode($result, true);
			$api_error_message = isset($error_data['error']['message']) ? $error_data['error']['message'] : 'Unknown API error';
			return "Error: API request failed (HTTP " . $http_code . ": " . $api_error_message . ")";
		}


		$result_decoded = json_decode($result, true);
		if (json_last_error() !== JSON_ERROR_NONE) {
			local_log("JSON Decode Error: " . json_last_error_msg() . " Raw Response: " . $result);
			return "Error: Could not decode API response.";
		}

		if (isset($result_decoded['choices'][0]['message']['content'])) {
			$chat_response_text = trim($result_decoded['choices'][0]['message']['content']);
		} elseif (isset($result_decoded['error'])) {
			// Handle cases where the API returns an error structure even with HTTP 200 (less common now)
			$api_error_message = isset($result_decoded['error']['message']) ? $result_decoded['error']['message'] : 'Unknown API error structure.';
			local_log("API Error Structure Received: " . $api_error_message);
			return "Error: " . $api_error_message;
		} else {
			local_log("Unexpected API response structure: " . print_r($result_decoded, true));
			// Return an error string instead of empty string for consistency
			return "Error: Unexpected API response structure.";
		}
		return $chat_response_text;
	}


	function generateKeywordsByImageBase64($base64_image, $mime_type = 'image/jpeg')
	{
		$keywordsPrompt = 'Generate a list of 20 relevant keywords for this image, suitable for search or tagging. Include single words and relevant two-word phrases (e.g., "dark forest", "abstract pattern"). Focus on visual elements, style, and potential use (e.g., "overlay", "texture"). Do not include any text written on the image. Output only a comma-separated list.';

		// Construct the data URI
		$data_uri = "data:" . $mime_type . ";base64," . $base64_image;

		$single_request = [
			[
				"role" => "user",
				"content" => [
					[
						"type" => "text",
						"text" => $keywordsPrompt
					],
					[
						"type" => "image_url",
						"image_url" => [
							"url" => $data_uri,
							"detail" => "auto" // Use "auto" or "high" for potentially better results
						]
					]
				]
			]
		];

		// Use gpt-4o as it's generally better with images
		$responseData_single = call_openAI_question($single_request, 0.5, 300, 'gpt-4o');

		local_log("Request to OpenAI for keywords: " . json_encode($single_request)); // Log request for debugging
		local_log("Response from OpenAI for keywords: " . $responseData_single);

		return $responseData_single;
	}

// --- Main Execution Logic ---

	echo "<h2>Overlay Processing Script</h2>";

// 1. Ensure output directory exists
	if (!is_dir($outputDir)) {
		if (!mkdir($outputDir, 0777, true)) {
			$errorMsg = "Error: Could not create output directory: " . htmlspecialchars($outputDir);
			local_log($errorMsg);
			die($errorMsg);
		} else {
			echo "Created output directory: " . htmlspecialchars($outputDir) . "\n<br>";
		}
	}
// Ensure data directory exists for the JSON file
	$dataDir = dirname($resultsFile);
	if (!is_dir($dataDir)) {
		if (!mkdir($dataDir, 0777, true)) {
			$errorMsg = "Error: Could not create data directory: " . htmlspecialchars($dataDir);
			local_log($errorMsg);
			die($errorMsg);
		} else {
			echo "Created data directory: " . htmlspecialchars($dataDir) . "\n<br>";
		}
	}


// 2. Load existing results
	$resultsData = [];
	if (file_exists($resultsFile)) {
		$jsonContent = file_get_contents($resultsFile);
		if ($jsonContent === false) {
			echo "<span style='color:red;'>Warning: Could not read existing results file: " . htmlspecialchars($resultsFile) . ". Continuing without loading.</span>\n<br>";
			local_log("Failed to read results file: " . $resultsFile);
		} else {
			$resultsData = json_decode($jsonContent, true); // Decode as associative array
			if (json_last_error() !== JSON_ERROR_NONE) {
				echo "<span style='color:red;'>Warning: Could not decode JSON from results file: " . htmlspecialchars($resultsFile) . ". Starting fresh.</span>\n<br>";
				local_log("JSON Decode Error in results file: " . json_last_error_msg());
				$resultsData = []; // Reset if JSON is invalid
			} else {
				echo "Loaded " . count($resultsData) . " existing entries from " . htmlspecialchars($resultsFile) . ".\n<br>";
			}
		}
	} else {
		echo "Results file '" . htmlspecialchars($resultsFile) . "' not found. Will create a new one.\n<br>";
	}

	echo "Scanning for PNG files in '" . htmlspecialchars($sourceDir) . "' and subdirectories...\n<br>";

	$processedCount = 0;
	$skippedCount = 0;
	$errorCount = 0;
	$newEntriesAdded = false;

	try {
		// Use RecursiveIteratorIterator to get all files
		$iterator = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator($sourceDir, RecursiveDirectoryIterator::SKIP_DOTS),
			RecursiveIteratorIterator::SELF_FIRST
		);

		$pngFiles = [];
		foreach ($iterator as $file) {
			if ($file->isFile() && strtolower($file->getExtension()) === 'png') {
				$pngFiles[] = $file->getPathname();
			}
		}

		if (empty($pngFiles)) {
			echo "No PNG files found in '" . htmlspecialchars($sourceDir) . "' or its subdirectories.\n<br>";
		} else {
			echo "Found " . count($pngFiles) . " PNG files. Processing...\n<br><hr>";

			foreach ($pngFiles as $originalPath) {
				$originalFilename = basename($originalPath);
				$relativePath = ltrim(str_replace($sourceDir, '', dirname($originalPath)), DIRECTORY_SEPARATOR); // Get path relative to sourceDir

				echo "Processing file: " . htmlspecialchars(($relativePath ? $relativePath . DIRECTORY_SEPARATOR : '') . $originalFilename) . "... ";

				// --- Generate Unique Base Filename ---
				$baseName = pathinfo($originalFilename, PATHINFO_FILENAME);
				// Sanitize relative path for use in filename
				$pathPrefix = str_replace(DIRECTORY_SEPARATOR, '-', trim($relativePath, DIRECTORY_SEPARATOR));
				$newBaseName = !empty($pathPrefix) ? $pathPrefix . '-' . $baseName : $baseName;
				// Replace any potentially problematic characters in the generated base name
				$newBaseName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $newBaseName);

				$counter = 0;
				$finalBaseName = $newBaseName;
				// Check for conflicts in the *output* directory
				while (
					file_exists($outputDir . DIRECTORY_SEPARATOR . $finalBaseName . '.png') ||
					file_exists($outputDir . DIRECTORY_SEPARATOR . $finalBaseName . '-preview.jpg')
				) {
					$counter++;
					$finalBaseName = $newBaseName . '_' . $counter;
				}
				// --- End Unique Filename Generation ---

				$newPngFilename = $finalBaseName . '.png';
				$newPreviewFilename = $finalBaseName . '-preview.jpg';
				$newPngPath = $outputDir . DIRECTORY_SEPARATOR . $newPngFilename;
				$newPreviewPath = $outputDir . DIRECTORY_SEPARATOR . $newPreviewFilename;

				// 3. Check if this *new* preview filename is already processed
				if (isset($resultsData[$newPreviewFilename])) {
					echo "<span style='color:blue;'>Skipped (already processed as " . htmlspecialchars($newPreviewFilename) . ")</span>\n<br><hr>";
					$skippedCount++;
					continue; // Skip to the next file
				}

				echo "Generating unique name: " . htmlspecialchars($finalBaseName) . "\n<br>";

				// 4. Create Thumbnail
				echo "Creating thumbnail (" . $thumbnailWidth . "px wide)... ";
				if (!create_thumbnail($originalPath, $newPreviewPath, $thumbnailWidth)) {
					echo "<span style='color:red;'>Error: Failed to create thumbnail for " . htmlspecialchars($originalFilename) . "</span>\n<br><hr>";
					local_log("Thumbnail creation failed for: " . $originalPath . " -> " . $newPreviewPath);
					$errorCount++;
					// Clean up potentially partially created file
					if (file_exists($newPreviewPath)) @unlink($newPreviewPath);
					continue; // Skip this file
				}
				echo "Thumbnail saved: " . htmlspecialchars($newPreviewFilename) . "\n<br>";

				// 5. Copy Original PNG
				echo "Copying original PNG... ";
				if (!copy($originalPath, $newPngPath)) {
					echo "<span style='color:red;'>Error: Failed to copy original PNG " . htmlspecialchars($originalFilename) . "</span>\n<br><hr>";
					local_log("Failed to copy " . $originalPath . " to " . $newPngPath);
					$errorCount++;
					// Clean up the created thumbnail if the copy fails
					if (file_exists($newPreviewPath)) @unlink($newPreviewPath);
					continue; // Skip this file
				}
				echo "Original copied: " . htmlspecialchars($newPngFilename) . "\n<br>";


				// 6. Read Thumbnail for API
				$thumbnailContent = @file_get_contents($newPreviewPath);
				if ($thumbnailContent === false) {
					echo "<span style='color:red;'>Error: Could not read generated thumbnail: " . htmlspecialchars($newPreviewFilename) . "</span>\n<br><hr>";
					local_log("Failed to read thumbnail file: " . $newPreviewPath);
					$errorCount++;
					// Clean up copied files
					if (file_exists($newPreviewPath)) @unlink($newPreviewPath);
					if (file_exists($newPngPath)) @unlink($newPngPath);
					continue; // Skip to the next file
				}

				// 7. Encode thumbnail content to Base64
				$base64Image = base64_encode($thumbnailContent);

				// 8. Generate Keywords via OpenAI
				echo "Generating keywords via OpenAI...\n<br>";
				$keywords_raw = generateKeywordsByImageBase64($base64Image, 'image/jpeg');
				$generatedKeywords = [];
				$keywords_error = null;

				if (strpos($keywords_raw, "Error:") === 0) {
					echo "<span style='color:red;'>Keyword Generation Failed: " . htmlspecialchars($keywords_raw) . "</span>\n<br>";
					local_log("Keyword generation failed for $newPreviewFilename: $keywords_raw");
					// Store the error, but don't count as a full processing error unless we decide otherwise
					$keywords_error = $keywords_raw;
					// $errorCount++; // Optionally count API errors as processing errors
					// We still created the files, so maybe don't 'continue' here, just record the error.
				} elseif (!empty($keywords_raw)) {
					// Clean the raw response (remove leading list markers, trim whitespace/quotes/commas)
					$pattern = '/(^[\s*-]+)/m'; // Remove leading spaces, asterisks, hyphens at the start of lines
					$keywords_cleaned = preg_replace($pattern, '', $keywords_raw);
					if ($keywords_cleaned === null) {
						local_log("preg_replace returned null for keywords_raw: " . $keywords_raw);
						$keywords_cleaned = $keywords_raw; // Fallback to raw if regex fails
					}
					$keywords_cleaned = trim((string)$keywords_cleaned, " \n\r\t\v\0.,\"'"); // Trim surrounding junk

					if (!empty($keywords_cleaned)) {
						$generatedKeywords = array_map('trim', explode(',', $keywords_cleaned));
						$generatedKeywords = array_filter($generatedKeywords); // Remove empty elements
						$generatedKeywords = array_unique($generatedKeywords); // Remove duplicates
						$generatedKeywords = array_values($generatedKeywords); // Re-index array
						echo "Generated Keywords: " . htmlspecialchars(implode(", ", $generatedKeywords)) . "\n<br>";
					} else {
						echo "<span style='color:orange;'>Warning: Keyword response became empty after cleaning. Original: '" . htmlspecialchars($keywords_raw) . "'</span>\n<br>";
						local_log("Empty keywords after cleaning for $newPreviewFilename. Original: $keywords_raw");
						$keywords_error = "Warning: Empty keywords after cleaning.";
					}
				} else {
					echo "<span style='color:orange;'>Warning: Received empty keyword response.</span>\n<br>";
					local_log("Empty keyword response for $newPreviewFilename");
					$keywords_error = "Warning: Received empty keyword response.";
				}

				// 9. Store results
				$resultsData[$newPreviewFilename] = [
					'keywords' => $generatedKeywords, // Store empty array if no keywords or error
					'keywords_error' => $keywords_error, // Store null or error message
					'original_path' => ($relativePath ? $relativePath . DIRECTORY_SEPARATOR : '') . $originalFilename, // Store original relative path for reference
					'processed_at' => date('Y-m-d H:i:s')
				];
				$newEntriesAdded = true;
				$processedCount++;

				echo "<hr>"; // Separator for readability
				flush(); // Flush output buffer to see progress
				ob_flush(); // Ensure output is sent

				// 10. Save progress periodically (e.g., after each file)
				if ($newEntriesAdded) {
					$jsonOutput = json_encode($resultsData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
					if ($jsonOutput === false) {
						echo "<span style='color:red;'>Error: Failed to encode results to JSON. " . json_last_error_msg() . "</span>\n<br>";
						local_log("Failed to encode results to JSON: " . json_last_error_msg());
						// Consider stopping or handling this more gracefully
					} elseif (file_put_contents($resultsFile, $jsonOutput) === false) {
						echo "<span style='color:red;'>Error: Could not write to results file during processing: " . htmlspecialchars($resultsFile) . "</span>\n<br>";
						local_log("Failed to write results file during processing: " . $resultsFile);
						// Consider stopping if saving fails repeatedly
					} else {
						$newEntriesAdded = false; // Reset flag after successful save
					}
				}
			} // End foreach loop

			echo "<hr>Processing complete.\n<br>";
			echo "<h3>Summary:</h3>";
			echo "<ul>";
			echo "<li>Files Processed Successfully: " . $processedCount . "</li>";
			echo "<li>Files Skipped (Already Processed): " . $skippedCount . "</li>";
			echo "<li>Errors Encountered (File Ops/Thumbnailing): " . $errorCount . "</li>";
			echo "</ul>";

			// Final save if anything was added but not saved in the last loop iteration
			if ($newEntriesAdded) {
				$jsonOutput = json_encode($resultsData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
				if ($jsonOutput !== false && file_put_contents($resultsFile, $jsonOutput) !== false) {
					echo "Final results saved to " . htmlspecialchars($resultsFile) . "\n<br>";
				} else {
					echo "<span style='color:red;'>Error: Could not perform final save to results file: " . htmlspecialchars($resultsFile) . "</span>\n<br>";
					local_log("Failed final save to results file: " . $resultsFile . (json_last_error() !== JSON_ERROR_NONE ? ' JSON Error: ' . json_last_error_msg() : ''));
				}
			}

		} // End else (files found)

	} catch (Exception $e) {
		$errorMsg = "An unexpected error occurred: " . $e->getMessage();
		local_log($errorMsg);
		echo "<span style='color:red;'>" . htmlspecialchars($errorMsg) . "</span>\n<br>";
		// Attempt a final save before dying
		if (!empty($resultsData)) {
			$jsonOutput = json_encode($resultsData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
			if ($jsonOutput !== false && file_put_contents($resultsFile, $jsonOutput) !== false) {
				local_log("Attempted final save after exception.");
				echo "Attempted final save of results before exiting due to error.\n<br>";
			} else {
				local_log("Failed final save attempt after exception.");
			}
		}
	}

	echo "Script finished.";

?>
