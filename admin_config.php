<?php // free-cover-designer/admin_config.php
	define('ADMIN_UPLOAD_BASE_DIR', __DIR__ . '/uploads'); // Absolute path on server
	define('ADMIN_UPLOAD_BASE_URL', 'uploads'); // Relative URL for web access
	define('ADMIN_AI_TEMPLATES_DIR', ADMIN_UPLOAD_BASE_DIR . '/text-templates-ai'); // New directory for AI generated templates

	define('THUMBNAIL_COVER_WIDTH', 150);
	define('THUMBNAIL_COVER_HEIGHT', 236); // Taller for covers/templates
	define('THUMBNAIL_ELEMENT_WIDTH', 150); // Square for elements/overlays
	define('THUMBNAIL_ELEMENT_HEIGHT', 150);
	define('THUMBNAIL_QUALITY', 85); // For JPEGs
	define('ADMIN_ITEMS_PER_PAGE',30);

// Ensure OPEN_AI_API_KEY is loaded if not already (db.php might do this)
	if (file_exists(__DIR__ . '/vendor/autoload.php')) {
		require_once __DIR__ . '/vendor/autoload.php';
		if (class_exists(Dotenv\Dotenv::class) && file_exists(__DIR__ . '/.env')) {
			$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
			$dotenv->load();
		}
	}

// Ensure base upload directory exists and is writable
	if (!is_dir(ADMIN_UPLOAD_BASE_DIR)) {
		if (!mkdir(ADMIN_UPLOAD_BASE_DIR, 0775, true)) {
			die('Failed to create base uploads directory: ' . ADMIN_UPLOAD_BASE_DIR . '. Please check permissions.');
		}
	}
	if (!is_writable(ADMIN_UPLOAD_BASE_DIR)) {
		// error_log('Warning: Base upload directory is not writable: ' . ADMIN_UPLOAD_BASE_DIR);
	}

// New: Ensure AI templates directory exists
	if (!is_dir(ADMIN_AI_TEMPLATES_DIR)) {
		if (!mkdir(ADMIN_AI_TEMPLATES_DIR, 0775, true)) {
			// Log error or die, depending on desired strictness
			error_log('Failed to create AI templates directory: ' . ADMIN_AI_TEMPLATES_DIR . '. Please check permissions.');
			// Optionally die: die('Failed to create AI templates directory: ' . ADMIN_AI_TEMPLATES_DIR);
		}
	}


	$upload_paths_config = [
		'covers' => [
			'originals' => ADMIN_UPLOAD_BASE_DIR . '/covers/originals',
			'thumbnails' => ADMIN_UPLOAD_BASE_DIR . '/covers/thumbnails',
			'originals_url' => ADMIN_UPLOAD_BASE_URL . '/covers/originals',
			'thumbnails_url' => ADMIN_UPLOAD_BASE_URL . '/covers/thumbnails',
			'thumb_w' => THUMBNAIL_COVER_WIDTH,
			'thumb_h' => THUMBNAIL_COVER_HEIGHT,
		],
		'elements' => [
			'originals' => ADMIN_UPLOAD_BASE_DIR . '/elements/originals',
			'thumbnails' => ADMIN_UPLOAD_BASE_DIR . '/elements/thumbnails',
			'originals_url' => ADMIN_UPLOAD_BASE_URL . '/elements/originals',
			'thumbnails_url' => ADMIN_UPLOAD_BASE_URL . '/elements/thumbnails',
			'thumb_w' => THUMBNAIL_ELEMENT_WIDTH,
			'thumb_h' => THUMBNAIL_ELEMENT_HEIGHT,
		],
		'overlays' => [
			'originals' => ADMIN_UPLOAD_BASE_DIR . '/overlays/originals',
			'thumbnails' => ADMIN_UPLOAD_BASE_DIR . '/overlays/thumbnails',
			'originals_url' => ADMIN_UPLOAD_BASE_URL . '/overlays/originals',
			'thumbnails_url' => ADMIN_UPLOAD_BASE_URL . '/overlays/thumbnails',
			'thumb_w' => THUMBNAIL_ELEMENT_WIDTH,
			'thumb_h' => THUMBNAIL_ELEMENT_HEIGHT,
		],
		'templates' => [
			'json' => ADMIN_UPLOAD_BASE_DIR . '/templates/json', // Not used for file storage in current setup
			'thumbnails' => ADMIN_UPLOAD_BASE_DIR . '/templates/thumbnails',
			'json_url' => ADMIN_UPLOAD_BASE_URL . '/templates/json', // Though json_content is stored in DB
			'thumbnails_url' => ADMIN_UPLOAD_BASE_URL . '/templates/thumbnails',
			'thumb_w' => THUMBNAIL_COVER_WIDTH,
			'thumb_h' => THUMBNAIL_COVER_HEIGHT,
		],
	];

// Ensure all specific directories exist
	foreach ($upload_paths_config as $type => $paths) {
		if (isset($paths['originals']) && !is_dir($paths['originals'])) {
			@mkdir($paths['originals'], 0775, true);
		}
		if (isset($paths['thumbnails']) && !is_dir($paths['thumbnails'])) {
			@mkdir($paths['thumbnails'], 0775, true);
		}
		if (isset($paths['json']) && !is_dir($paths['json'])) { // For template JSON files if ever stored on disk
			@mkdir($paths['json'], 0775, true);
		}
	}

// Helper function for thumbnail generation (GD Library)
// ... (create_thumbnail function remains the same)
	function create_thumbnail($source_path, $destination_path, $thumb_width, $thumb_height, $quality = 85) {
		if (!function_exists('gd_info')) {
			error_log("GD Library is not installed or enabled.");
			return false;
		}
		list($width, $height, $type) = getimagesize($source_path);
		if (!$width || !$height) {
			error_log("Invalid image dimensions or unsupported file: " . $source_path);
			return false;
		}
		$source_image = null;
		switch ($type) {
			case IMAGETYPE_JPEG: $source_image = @imagecreatefromjpeg($source_path); break;
			case IMAGETYPE_PNG: $source_image = @imagecreatefrompng($source_path); break;
			case IMAGETYPE_GIF: $source_image = @imagecreatefromgif($source_path); break;
			default: error_log("Unsupported image type for thumbnail: " . image_type_to_mime_type($type)); return false;
		}
		if (!$source_image) {
			error_log("Failed to create image resource from: " . $source_path);
			return false;
		}
		$source_aspect_ratio = $width / $height;
		$thumb_aspect_ratio = $thumb_width / $thumb_height;
		if ($source_aspect_ratio > $thumb_aspect_ratio) {
			$new_width = $thumb_width;
			$new_height = (int) ($thumb_width / $source_aspect_ratio);
		} else {
			$new_height = $thumb_height;
			$new_width = (int) ($thumb_height * $source_aspect_ratio);
		}
		$thumb_image = imagecreatetruecolor($new_width, $new_height);
		if (!$thumb_image) {
			error_log("Failed to create true color image for thumbnail.");
			imagedestroy($source_image);
			return false;
		}
		if ($type == IMAGETYPE_PNG) {
			imagealphablending($thumb_image, false);
			imagesavealpha($thumb_image, true);
			$transparent = imagecolorallocatealpha($thumb_image, 255, 255, 255, 127);
			imagefilledrectangle($thumb_image, 0, 0, $new_width, $new_height, $transparent);
			imagecolortransparent($thumb_image, $transparent);
		} else if ($type == IMAGETYPE_GIF) {
			$transparent_index = imagecolortransparent($source_image);
			if ($transparent_index >= 0) {
				$transparent_color = imagecolorsforindex($source_image, $transparent_index);
				$transparent_new = imagecolorallocatealpha($thumb_image, $transparent_color['red'], $transparent_color['green'], $transparent_color['blue'], 127);
				imagefill($thumb_image, 0, 0, $transparent_new);
				imagecolortransparent($thumb_image, $transparent_new);
			}
		}
		if (!imagecopyresampled($thumb_image, $source_image, 0, 0, 0, 0, $new_width, $new_height, $width, $height)) {
			error_log("Failed to resample image for thumbnail.");
			imagedestroy($source_image);
			imagedestroy($thumb_image);
			return false;
		}
		$success = false;
		switch ($type) {
			case IMAGETYPE_JPEG: $success = imagejpeg($thumb_image, $destination_path, $quality); break;
			case IMAGETYPE_PNG: $png_quality = round((100 - $quality) / 10); $success = imagepng($thumb_image, $destination_path, $png_quality); break;
			case IMAGETYPE_GIF: $success = imagegif($thumb_image, $destination_path); break;
		}
		if (!$success) {
			error_log("Failed to save thumbnail to: " . $destination_path);
		}
		imagedestroy($source_image);
		imagedestroy($thumb_image);
		return $success;
	}


// ... (sanitize_filename, get_server_path_from_url functions remain the same)
	function sanitize_filename($filename) {
		$filename = basename($filename);
		$filename = preg_replace("/[^a-zA-Z0-9\._-]/", "", $filename);
		$filename = preg_replace("/\.{2,}/", ".", $filename);
		$filename = trim($filename, ".-_");
		$filename = substr($filename, 0, 200);
		if (empty($filename)) {
			$filename = "file";
		}
		return $filename;
	}

	function get_server_path_from_url($url) {
		$base_url_trimmed = rtrim(ADMIN_UPLOAD_BASE_URL, '/');
		if (strpos($url, $base_url_trimmed . '/') === 0) {
			$relative_path = substr($url, strlen($base_url_trimmed . '/'));
			return rtrim(ADMIN_UPLOAD_BASE_DIR, '/') . '/' . $relative_path;
		}
		$parsed_url = parse_url($url);
		if (isset($parsed_url['path'])) {
			if (strpos($parsed_url['path'], '/uploads/') !== false) {
				$path_part = strstr($parsed_url['path'], '/uploads/');
				$relative_path = ltrim($path_part, '/');
				if (strpos($relative_path, ADMIN_UPLOAD_BASE_URL . '/') === 0) {
					$relative_path = substr($relative_path, strlen(ADMIN_UPLOAD_BASE_URL . '/'));
				}
				return rtrim(ADMIN_UPLOAD_BASE_DIR, '/') . '/' . $relative_path;
			} else {
				// If it's not matching ADMIN_UPLOAD_BASE_URL and not containing /uploads/, it might be an absolute path already or something else.
				// This part is tricky without knowing all possible URL formats.
				// For now, if it doesn't match the expected structure, return null or log an error.
				// Let's assume for now it might be a direct path if not matching, but this is risky.
				// A safer bet is to return null if not matching the expected structure.
				// However, the original code returned $url, which could be problematic.
				// For this application, URLs are expected to be relative to ADMIN_UPLOAD_BASE_URL.
			}
		}
		error_log("Could not convert URL to server path: " . $url . " (ADMIN_UPLOAD_BASE_URL: " . $base_url_trimmed . ")");
		return null;
	}


// --- OpenAI Helper Functions ---
// ... (local_log, call_openAI_question, generate_metadata_from_image_base64, parse_ai_list_response functions remain the same)
// Note: call_openAI_question will be used for text generation too, with gpt-4o model.
	function local_log($message) {
		$logFile = __DIR__ . '/openai_api_log.txt'; // Log in the same directory
		file_put_contents($logFile, date('Y-m-d H:i:s') . " - " . $message . PHP_EOL, FILE_APPEND);
	}

	function call_openAI_question($messages, $temperature, $max_tokens, $model = 'gpt-4o-mini') { // Default model changed to gpt-4o-mini, can be overridden
		if (empty($_ENV['OPEN_AI_API_KEY'])) {
			local_log("OpenAI API Key is missing.");
			return ["error" => "Error: API Key missing."];
		}
		$data = [
			'model' => $model,
			'messages' => $messages,
//			'temperature' => (float)$temperature,
//			'max_tokens' => (int)$max_tokens,
			'top_p' => 1,
			'frequency_penalty' => 0,
			'presence_penalty' => 0,
			'n' => 1,
			'stream' => false,
		];
		// For JSON mode if the model supports it and we want to enforce JSON output
		// if (strpos($model, 'gpt-4') !== false || strpos($model, 'gpt-3.5-turbo-1106') !== false) { // Check if model supports JSON mode
		//    $data['response_format'] = ['type' => 'json_object'];
		// }

		$post_json = json_encode($data);
		if (json_last_error() !== JSON_ERROR_NONE) {
			local_log("JSON Encode Error: " . json_last_error_msg());
			return ["error" => "Error: Could not encode data for API."];
		}

		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, 'https://api.openai.com/v1/chat/completions');
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
		curl_setopt($ch, CURLOPT_POST, 1);
		curl_setopt($ch, CURLOPT_POSTFIELDS, $post_json);
		curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 20); // Increased connect timeout
		curl_setopt($ch, CURLOPT_TIMEOUT, 180);      // Increased general timeout for potentially long AI responses
		curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
		curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
		$headers = [
			'Content-Type: application/json',
			"Authorization: Bearer " . $_ENV['OPEN_AI_API_KEY']
		];
		curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

		$result = curl_exec($ch);
		if (curl_errno($ch)) {
			$error_msg = curl_error($ch);
			curl_close($ch);
			local_log("cURL Error: " . $error_msg);
			return ["error" => "Error: API request failed (cURL: " . $error_msg . ")"];
		}
		$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		curl_close($ch);

		$result_decoded = json_decode($result, true);
		if (json_last_error() !== JSON_ERROR_NONE) {
			local_log("JSON Decode Error: " . json_last_error_msg() . " Raw Response: " . $result . " HTTP Code: " . $http_code);
			return ["error" => "Error: Could not decode API response. HTTP Code: " . $http_code];
		}

		if ($http_code >= 400) {
			$api_error_message = $result_decoded['error']['message'] ?? 'Unknown API error';
			local_log("API Error: HTTP Code " . $http_code . " Response: " . $result);
			return ["error" => "Error: API request failed (HTTP " . $http_code . ": " . $api_error_message . ")"];
		}

		if (isset($result_decoded['choices'][0]['message']['content'])) {
			return ["content" => trim($result_decoded['choices'][0]['message']['content'])];
		} elseif (isset($result_decoded['error'])) {
			$api_error_message = $result_decoded['error']['message'] ?? 'Unknown API error structure.';
			local_log("API Error Structure Received: " . $api_error_message);
			return ["error" => "Error: " . $api_error_message];
		} else {
			local_log("Unexpected API response structure: " . print_r($result_decoded, true));
			return ["error" => "Error: Unexpected API response structure."];
		}
	}

	function generate_metadata_from_image_base64($prompt, $base64_image, $mime_type = 'image/jpeg', $model = 'gpt-4o-mini') {
		$data_uri = "data:" . $mime_type . ";base64," . $base64_image;
		$request_messages = [
			[
				"role" => "user",
				"content" => [
					["type" => "text", "text" => $prompt],
					["type" => "image_url", "image_url" => ["url" => $data_uri, "detail" => "auto"]]
				]
			]
		];
		// local_log("Request to OpenAI for prompt '$prompt': " . json_encode($request_messages)); // Can be verbose
		$response = call_openAI_question($request_messages, 0.5, 300, $model); // gpt-4o-mini is cheaper, gpt-4o for higher quality
		// local_log("Response from OpenAI for prompt '$prompt': " . json_encode($response));
		return $response; // This will be an array like ["content" => "..."] or ["error" => "..."]
	}

	function parse_ai_list_response($raw_response_content) {
		if (empty($raw_response_content)) return [];
		// Remove potential markdown list characters like '-' or '*' at the start of lines
		$cleaned = preg_replace('/(^[\s*-]+)/m', '', $raw_response_content);
		// Trim whitespace, quotes, and trailing commas
		$cleaned = trim($cleaned, " \n\r\t\v\0.,\"'");
		if (empty($cleaned)) return [];
		$items = array_map('trim', explode(',', $cleaned));
		$items = array_filter($items, function($value) {
			return !empty($value);
		}); // Remove empty elements
		$items = array_unique($items); // Remove duplicates
		return array_values($items); // Re-index
	}
?>
