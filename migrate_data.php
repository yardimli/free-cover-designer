<?php
// migrate_data.php
// Run this script once from the command line (php migrate_data.php) or via browser
// after creating the tables in your database.

	require_once 'db.php'; // Include your database connection setup

// --- Helper function for cleaning names ---
	function clean_name($filename) {
		$name = pathinfo($filename, PATHINFO_FILENAME);
		// Remove common suffixes like -preview
		if (str_ends_with(strtolower($name), '-preview')) {
			$name = substr($name, 0, -8);
		}
		return ucwords(str_replace(['-', '_'], ' ', $name));
	}

	echo "Starting data migration...\n";

// --- Migrate Covers ---
	echo "Migrating Covers...\n";
	$covers_json_path = 'data/covers.json';
	$covers_dir = 'covers';
	$covers_migrated = 0;
	$covers_skipped = 0;

	if (file_exists($covers_json_path)) {
		try {
			$json_content = file_get_contents($covers_json_path);
			$raw_covers_data = json_decode($json_content, true);

			if (is_array($raw_covers_data)) {
				// Prepare statement
				$stmt = $mysqlDBConn->prepare("
                INSERT INTO covers (name, thumbnail_path, image_path, caption, keywords, categories)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                thumbnail_path = VALUES(thumbnail_path),
                image_path = VALUES(image_path),
                caption = VALUES(caption),
                keywords = VALUES(keywords),
                categories = VALUES(categories)
            ");

				if (!$stmt) {
					throw new Exception("Prepare failed: (" . $mysqlDBConn->errno . ") " . $mysqlDBConn->error);
				}

				foreach ($raw_covers_data as $preview_filename => $details) {
					$base_name = pathinfo($preview_filename, PATHINFO_FILENAME);
					if (str_ends_with(strtolower($base_name), '-preview')) {
						$base_name = substr($base_name, 0, -8);
					}
					$name = clean_name($base_name); // Use base name for cleaning

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
						$caption = isset($details['caption']) ? $details['caption'] : null;
						$keywords = isset($details['keywords']) && is_array($details['keywords']) ? json_encode($details['keywords']) : null;
						$categories = isset($details['categories']) && is_array($details['categories']) ? json_encode($details['categories']) : null;

						// Bind parameters (s = string)
						$stmt->bind_param("ssssss", $name, $thumbnail_path, $target_image_path, $caption, $keywords, $categories);

						if ($stmt->execute()) {
							$covers_migrated++;
						} else {
							echo "Error inserting cover '$name': " . $stmt->error . "\n";
							$covers_skipped++;
						}
					} else {
						echo "Skipping cover '$name': Missing thumbnail ($thumbnail_path) or image file ($target_jpg_path / $target_png_path).\n";
						$covers_skipped++;
					}
				}
				$stmt->close();
				echo "Covers migration complete. Migrated: $covers_migrated, Skipped/Errors: $covers_skipped\n";
			} else {
				echo "Error: covers.json did not decode into an array.\n";
			}
		} catch (Exception $e) {
			echo "Error processing covers.json: " . $e->getMessage() . "\n";
		}
	} else {
		echo "Error: covers.json not found at path: " . $covers_json_path . "\n";
	}
	echo "-------------------------\n";


// --- Migrate Overlays ---
	echo "Migrating Overlays...\n";
	$overlays_json_path = 'data/overlays.json';
	$overlays_dir = 'overlays'; // Make sure this matches your actual directory
	$overlays_migrated = 0;
	$overlays_skipped = 0;

	if (file_exists($overlays_json_path)) {
		try {
			$json_content = file_get_contents($overlays_json_path);
			$raw_overlays_data = json_decode($json_content, true);

			if (is_array($raw_overlays_data)) {
				// Prepare statement
				$stmt = $mysqlDBConn->prepare("
                INSERT INTO overlays (name, thumbnail_path, image_path, keywords)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                thumbnail_path = VALUES(thumbnail_path),
                image_path = VALUES(image_path),
                keywords = VALUES(keywords)
            ");

				if (!$stmt) {
					throw new Exception("Prepare failed: (" . $mysqlDBConn->errno . ") " . $mysqlDBConn->error);
				}

				foreach ($raw_overlays_data as $preview_filename => $details) {
					$base_name = pathinfo($preview_filename, PATHINFO_FILENAME);
					if (str_ends_with(strtolower($base_name), '-preview')) {
						$base_name = substr($base_name, 0, -8);
					}
					$name = clean_name($base_name); // Use base name for cleaning

					$thumbnail_path = $overlays_dir . '/' . $preview_filename;
					$target_png_path = $overlays_dir . '/' . $base_name . '.png'; // Assume overlays are PNG

					if (file_exists($thumbnail_path) && file_exists($target_png_path)) {
						$keywords = isset($details['keywords']) && is_array($details['keywords']) ? json_encode($details['keywords']) : null;

						// Bind parameters (s = string)
						$stmt->bind_param("ssss", $name, $thumbnail_path, $target_png_path, $keywords);

						if ($stmt->execute()) {
							$overlays_migrated++;
						} else {
							echo "Error inserting overlay '$name': " . $stmt->error . "\n";
							$overlays_skipped++;
						}
					} else {
						echo "Skipping overlay '$name': Missing thumbnail ($thumbnail_path) or image file ($target_png_path).\n";
						$overlays_skipped++;
					}
				}
				$stmt->close();
				echo "Overlays migration complete. Migrated: $overlays_migrated, Skipped/Errors: $overlays_skipped\n";
			} else {
				echo "Error: overlays.json did not decode into an array.\n";
			}
		} catch (Exception $e) {
			echo "Error processing overlays.json: " . $e->getMessage() . "\n";
		}
	} else {
		echo "Error: overlays.json not found at path: " . $overlays_json_path . "\n";
	}
	echo "-------------------------\n";


// --- Migrate Templates ---
	echo "Migrating Templates...\n";
	$template_dir = 'text-templates';
	$templates_migrated = 0;
	$templates_skipped = 0;

	if (is_dir($template_dir)) {
		// Prepare statement
		$stmt = $mysqlDBConn->prepare("
        INSERT INTO templates (name, thumbnail_path, json_path, json_content)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        thumbnail_path = VALUES(thumbnail_path),
        json_path = VALUES(json_path),
        json_content = VALUES(json_content)
    ");

		if (!$stmt) {
			throw new Exception("Prepare failed: (" . $mysqlDBConn->errno . ") " . $mysqlDBConn->error);
		}

		$files = scandir($template_dir);
		foreach ($files as $file) {
			if (pathinfo($file, PATHINFO_EXTENSION) === 'json') {
				$name_base = pathinfo($file, PATHINFO_FILENAME);
				$name = clean_name($name_base); // Use base name for cleaning
				$json_path = $template_dir . '/' . $file;
				$thumb_path = $template_dir . '/' . $name_base . '.png';

				if (file_exists($json_path) && file_exists($thumb_path)) {
					try {
						$json_content_string = file_get_contents($json_path);
						// Validate JSON before inserting
						$decoded_json = json_decode($json_content_string);
						if (json_last_error() === JSON_ERROR_NONE && $decoded_json !== null) {
							// Bind parameters (s = string)
							$stmt->bind_param("ssss", $name, $thumb_path, $json_path, $json_content_string);

							if ($stmt->execute()) {
								$templates_migrated++;
							} else {
								echo "Error inserting template '$name': " . $stmt->error . "\n";
								$templates_skipped++;
							}
						} else {
							echo "Skipping template '$name': Invalid JSON content in file ($json_path). Error: " . json_last_error_msg() . "\n";
							$templates_skipped++;
						}
					} catch (Exception $e) {
						echo "Skipping template '$name': Error reading file ($json_path): " . $e->getMessage() . "\n";
						$templates_skipped++;
					}
				} else {
					echo "Skipping template '$name': Missing JSON ($json_path) or thumbnail ($thumb_path).\n";
					$templates_skipped++;
				}
			}
		}
		$stmt->close();
		echo "Templates migration complete. Migrated: $templates_migrated, Skipped/Errors: $templates_skipped\n";
	} else {
		echo "Error: Template directory not found: " . $template_dir . "\n";
	}
	echo "-------------------------\n";



	// --- Migrate Elements ---
	echo "Migrating Elements...\n";
	$elements_json_path = 'data/elements.json';
	$elements_dir = 'elements'; // Make sure this matches your actual directory
	$elements_migrated = 0;
	$elements_skipped = 0;

	if (file_exists($elements_json_path)) {
		try {
			$json_content = file_get_contents($elements_json_path);
			$raw_elements_data = json_decode($json_content, true);

			if (is_array($raw_elements_data)) {
				// Prepare statement
				$stmt = $mysqlDBConn->prepare("
                INSERT INTO elements (name, thumbnail_path, image_path, keywords)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                thumbnail_path = VALUES(thumbnail_path),
                image_path = VALUES(image_path),
                keywords = VALUES(keywords)
            ");

				if (!$stmt) {
					throw new Exception("Prepare failed: (" . $mysqlDBConn->errno . ") " . $mysqlDBConn->error);
				}

				foreach ($raw_elements_data as $preview_filename => $details) {
					$base_name = pathinfo($preview_filename, PATHINFO_FILENAME);
					if (str_ends_with(strtolower($base_name), '-preview')) {
						$base_name = substr($base_name, 0, -8);
					}
					$name = clean_name($base_name); // Use base name for cleaning

					$thumbnail_path = $elements_dir . '/' . $preview_filename;
					$target_png_path = $elements_dir . '/' . $base_name . '.png'; // Assume elements are PNG

					if (file_exists($thumbnail_path) && file_exists($target_png_path)) {
						$keywords = isset($details['keywords']) && is_array($details['keywords']) ? json_encode($details['keywords']) : null;

						// Bind parameters (s = string)
						$stmt->bind_param("ssss", $name, $thumbnail_path, $target_png_path, $keywords);

						if ($stmt->execute()) {
							$elements_migrated++;
						} else {
							echo "Error inserting element '$name': " . $stmt->error . "\n";
							$elements_skipped++;
						}
					} else {
						echo "Skipping element '$name': Missing thumbnail ($thumbnail_path) or image file ($target_png_path).\n";
						$elements_skipped++;
					}
				}
				$stmt->close();
				echo "Elements migration complete. Migrated: $elements_migrated, Skipped/Errors: $elements_skipped\n";
			} else {
				echo "Error: elements.json did not decode into an array.\n";
			}
		} catch (Exception $e) {
			echo "Error processing elements.json: " . $e->getMessage() . "\n";
		}
	} else {
		echo "Error: elements.json not found at path: " . $elements_json_path . "\n";
	}
	echo "-------------------------\n";

// --- Close DB Connection ---
	$mysqlDBConn->close();
	echo "Migration script finished.\n";

?>
