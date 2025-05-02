<?php
	set_time_limit(30000); // Increased time limit for potentially many API calls

	require 'vendor/autoload.php'; // If using Dotenv
	$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
	$dotenv->load();
	if (empty($_ENV['OPEN_AI_API_KEY'])) {
		die("Error: OPEN_AI_API_KEY environment variable not set.");
	}

	function local_log($message)
	{
		$logFile = 'error_log.txt'; // Specify your log file
		file_put_contents($logFile, date('Y-m-d H:i:s') . " - " . $message . PHP_EOL, FILE_APPEND);
	}

	function call_openAI_question($messages, $temperature, $max_tokens, $model = 'gpt-4o-mini')
	{
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


	function generateByImageBase64($prompt, $base64_image, $mime_type = 'image/jpeg')
	{
		// Construct the data URI
		$data_uri = "data:" . $mime_type . ";base64," . $base64_image;

		$single_request = [
			[
				"role" => "user",
				"content" => [
					[
						"type" => "text",
						"text" => $prompt
					],
					[
						"type" => "image_url",
						"image_url" => [
							"url" => $data_uri,
							// Use "auto" or "high" for potentially better results, "low" for speed/cost
							"detail" => "auto"
						]
					]
				]
			]
		];

		$responseData_single = call_openAI_question($single_request, 0.5, 300, 'gpt-4o');

		 local_log("Request to OpenAI for prompt '$prompt': " . json_encode($single_request));
		 local_log("Response from OpenAI for prompt '$prompt': " . $responseData_single);

		return $responseData_single;
	}

	// --- Main Execution Logic ---

	$coversDir = 'covers';
	$filePattern = $coversDir . '/*-preview.jpg';
	$resultsFile = 'results.json';
	$resultsData = [];

	// 1. Load existing results if the file exists
	if (file_exists($resultsFile)) {
		$jsonContent = file_get_contents($resultsFile);
		if ($jsonContent === false) {
			echo "<span style='color:red;'>Error: Could not read existing results file: " . htmlspecialchars($resultsFile) . "</span>\n<br>";
			local_log("Failed to read results file: " . $resultsFile);
			exit;
		} else {
			$resultsData = json_decode($jsonContent, true); // Decode as associative array
			if (json_last_error() !== JSON_ERROR_NONE) {
				echo "<span style='color:red;'>Error: Could not decode JSON from results file: " . htmlspecialchars($resultsFile) . ". Starting fresh.</span>\n<br>";
				local_log("JSON Decode Error in results file: " . json_last_error_msg());
				$resultsData = []; // Reset if JSON is invalid
			} else {
				echo "Loaded " . count($resultsData) . " existing entries from " . htmlspecialchars($resultsFile) . ".\n<br>";
			}
		}
	} else {
		echo "Results file '" . htmlspecialchars($resultsFile) . "' not found. Will create a new one.\n<br>";
	}


	echo "Scanning for files in '$coversDir' matching '*-preview.jpg'...\n<br>";

	$imageFiles = glob($filePattern);
	$processedCount = 0;
	$skippedCount = 0;
	$errorCount = 0;
	$newEntriesAdded = false;

	if ($imageFiles === false || count($imageFiles) === 0) {
		echo "No matching image files found in '$coversDir'.\n<br>";
	} else {
		echo "Found " . count($imageFiles) . " files. Processing...\n<br><hr>";

		foreach ($imageFiles as $imagePath) {
			$filename = basename($imagePath);
			echo "Checking file: " . htmlspecialchars($filename) . "... ";

			// 2. Check if the file is already processed
			if (isset($resultsData[$filename])) {
				echo "<span style='color:blue;'>Skipped (already in results.json)</span>\n<br><hr>";
				$skippedCount++;
				continue; // Skip to the next file
			}

			echo "Processing...\n<br>";

			// 3. Read image file content
			$imageContent = @file_get_contents($imagePath);
			if ($imageContent === false) {
				echo "<span style='color:red;'>Error: Could not read file: " . htmlspecialchars($filename) . "</span>\n<br><hr>";
				local_log("Failed to read file: " . $imagePath);
				$errorCount++;
				continue; // Skip to the next file
			}

			// 4. Encode image content to Base64
			$base64Image = base64_encode($imageContent);

			// 5. Define prompts
			$captionPrompt = 'Describe this image concisely for use as an alt text or short caption. Focus on the main visual elements and mood. Don\'t include or describe any text visible on the image. Maximum 140 characters.';
			$keywordsPrompt = 'Generate a list of 20 relevant keywords for this book cover image, suitable for search or tagging. Include single words and relevant two-word phrases (e.g., "dark forest", "fantasy novel"). Focus on visual elements, genre, and mood. Do not include any text written on the cover. Output only a comma-separated list.';

			// 6. Generate Caption
			echo "Generating caption...\n<br>";
			$caption = generateByImageBase64($captionPrompt, $base64Image, 'image/jpeg');

			if (strpos($caption, "Error:") === 0) {
				echo "<span style='color:red;'>Caption Generation Failed: " . htmlspecialchars($caption) . "</span>\n<br>";
				local_log("Caption generation failed for $filename: $caption");
				$errorCount++;
				continue;
			} else {
				echo "Generated Caption: " . htmlspecialchars($caption) . "\n<br>";
			}

			// 7. Generate Keywords
			echo "Generating keywords...\n<br>";
			$keywords_raw = generateByImageBase64($keywordsPrompt, $base64Image, 'image/jpeg');
			$generatedKeywords = [];

			if (strpos($keywords_raw, "Error:") === 0) {
				echo "<span style='color:red;'>Keyword Generation Failed: " . htmlspecialchars($keywords_raw) . "</span>\n<br>";
				local_log("Keyword generation failed for $filename: $keywords_raw");
				$errorCount++;
				continue;
			} elseif (!empty($keywords_raw)) {
				$pattern = '/(^[\s*-]+)/m';
				$keywords_cleaned = preg_replace($pattern, '', $keywords_raw);

				if ($keywords_cleaned === null) {
					local_log("preg_replace returned null for keywords_raw: " . $keywords_raw);
					$keywords_cleaned = ''; // Default to empty string on error
				}

				$keywords_cleaned = trim((string)$keywords_cleaned, " \n\r\t\v\0.,\"'");

				if (!empty($keywords_cleaned)) { // Check if anything remains after cleaning
					$generatedKeywords = array_map('trim', explode(',', $keywords_cleaned));
					$generatedKeywords = array_filter($generatedKeywords); // Remove empty elements
					$generatedKeywords = array_unique($generatedKeywords); // Remove duplicates
					$generatedKeywords = array_values($generatedKeywords); // Re-index array
					echo "Generated Keywords: " . htmlspecialchars(implode(", ", $generatedKeywords)) . "\n<br>";
				} else {
					echo "<span style='color:orange;'>Warning: Keyword response became empty after cleaning. Original: '" . htmlspecialchars($keywords_raw) . "'</span>\n<br>";
					local_log("Empty keywords after cleaning for $filename. Original: $keywords_raw");
				}
			} else {
				echo "<span style='color:orange;'>Warning: Received empty keyword response.</span>\n<br>";
				local_log("Empty keyword response for $filename");
			}

			$currentCaption = (strpos($caption, "Error:") === 0) ? null : $caption;
			$currentKeywords = (strpos($keywords_raw, "Error:") === 0 || empty($generatedKeywords)) ? [] : $generatedKeywords;

			$resultsData[$filename] = [
				'caption' => $currentCaption,
				'keywords' => $currentKeywords,
				'processed_at' => date('Y-m-d H:i:s'),
				'caption_error' => (strpos($caption, "Error:") === 0) ? $caption : null,
				'keywords_error' => (strpos($keywords_raw, "Error:") === 0) ? $keywords_raw : null,
			];
			$newEntriesAdded = true; // Mark that we need to save
			$processedCount++;


			echo "<hr>"; // Separator for readability
			flush(); // Flush output buffer to see progress for long scripts
			ob_flush(); // Ensure output is sent to the browser

			if ($newEntriesAdded) {
				$jsonOutput = json_encode($resultsData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
				if (file_put_contents($resultsFile, $jsonOutput) === false) {
					echo "<span style='color:red;'>Error: Could not write to results file during processing: " . htmlspecialchars($resultsFile) . "</span>\n<br>";
					local_log("Failed to write results file during processing: " . $resultsFile);
				} else {
					$newEntriesAdded = false; // Reset flag after saving
				}
			}
		}

		echo "<hr>Processing complete.\n<br>";
		echo "Summary:\n<br>";
		echo "- Files Processed: " . $processedCount . "\n<br>";
		echo "- Files Skipped: " . $skippedCount . "\n<br>";
		echo "- Errors Encountered (during processing new files): " . $errorCount . "\n<br>";

	}

?>
