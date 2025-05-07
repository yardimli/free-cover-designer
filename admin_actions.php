<?php // free-cover-designer/admin_actions.php
	require_once 'db.php'; // Establishes $mysqlDBConn
	require_once 'admin_config.php'; // Defines constants, helper functions, and now OpenAI functions

	header('Content-Type: application/json');

// Basic input retrieval and sanitization
	$action = (isset($_REQUEST['action']) && is_scalar($_REQUEST['action'])) ? strip_tags($_REQUEST['action']) : null;
	$item_type = (isset($_REQUEST['item_type']) && is_scalar($_REQUEST['item_type'])) ? strip_tags($_REQUEST['item_type']) : null;
	$item_id = null;
	if (isset($_REQUEST['id'])) { // For most actions
		$val = $_REQUEST['id'];
		if (is_scalar($val) && preg_match('/^-?\d+$/', (string)$val)) {
			$item_id = (int)$val;
		}
	} elseif (isset($_REQUEST['original_template_id'])) { // For generate_similar_template
		$val = $_REQUEST['original_template_id'];
		if (is_scalar($val) && preg_match('/^-?\d+$/', (string)$val)) {
			$item_id = (int)$val; // Use item_id for consistency
		}
	}


// Ensure OPEN_AI_API_KEY is available
	if (empty($_ENV['OPEN_AI_API_KEY']) && in_array($action, ['generate_ai_metadata', 'generate_similar_template'])) {
		respond_error('OpenAI API Key is not configured on the server.');
	}

	function respond_error($message, $details = [], $http_code = 400) {
		http_response_code($http_code);
		echo json_encode(['success' => false, 'message' => $message, 'details' => $details]);
		exit;
	}

	function respond_success($message, $data = []) {
		echo json_encode(['success' => true, 'message' => $message, 'data' => $data]);
		exit;
	}

// ... (delete_associated_files function remains the same)
	function delete_associated_files($item, $item_type, $path_config) {
		$deleted_files = [];
		$config = $path_config[$item_type] ?? null;
		if (!$config) return $deleted_files;

		if (!empty($item['image_path'])) {
			$server_path = get_server_path_from_url($item['image_path']);
			if ($server_path && file_exists($server_path)) {
				if (@unlink($server_path)) $deleted_files[] = $server_path;
				else error_log("Failed to delete file: " . $server_path);
			}
		}
		if (!empty($item['thumbnail_path'])) {
			$server_path = get_server_path_from_url($item['thumbnail_path']);
			// Avoid double deletion if thumbnail and image are the same (e.g. for templates on upload)
			if ($server_path && file_exists($server_path) && (!isset($item['image_path']) || get_server_path_from_url($item['image_path']) !== $server_path)) {
				if (@unlink($server_path)) $deleted_files[] = $server_path;
				else error_log("Failed to delete file: " . $server_path);
			}
		}
		// Note: JSON content for templates is in DB, not a separate file managed here by default.
		return $deleted_files;
	}


	switch ($action) {
		case 'list_items':
			handle_list_items($mysqlDBConn, $upload_paths_config);
			break;
		case 'upload_item':
			handle_upload_item($mysqlDBConn, $item_type, $upload_paths_config);
			break;
		case 'delete_item':
			handle_delete_item($mysqlDBConn, $item_type, $upload_paths_config, $item_id);
			break;
		case 'get_item_details':
			handle_get_item_details($mysqlDBConn, $item_type, $item_id);
			break;
		case 'update_item':
			handle_update_item($mysqlDBConn, $item_type, $upload_paths_config, $item_id);
			break;
		case 'generate_ai_metadata':
			handle_generate_ai_metadata($mysqlDBConn, $item_type, $item_id, $upload_paths_config);
			break;
		case 'generate_similar_template': // New Action
			handle_generate_similar_template($mysqlDBConn, $item_id); // item_id here is original_template_id
			break;
		default:
			respond_error('Invalid action specified.');
	}

// --- Action Handlers ---
// ... (handle_list_items, handle_upload_item, handle_delete_item, handle_get_item_details, handle_update_item, handle_generate_ai_metadata functions remain the same)
// Ensure handle_get_item_details returns 'json_content' for templates. It already does by selecting *.
// For brevity, I'm not re-pasting all existing handlers. Assume they are correct.

	function handle_list_items($db, $path_config) {
		$type = (isset($_GET['type']) && is_scalar($_GET['type'])) ? strip_tags($_GET['type']) : null;
		$page = 1;
		if (isset($_GET['page'])) {
			$val = $_GET['page'];
			if (is_scalar($val) && preg_match('/^\d+$/', (string)$val)) {
				$val_int = (int)$val;
				if ($val_int >= 1) { $page = $val_int; }
			}
		}
		$limit = ADMIN_ITEMS_PER_PAGE;
		if (isset($_GET['limit'])) {
			$val = $_GET['limit'];
			if (is_scalar($val) && preg_match('/^\d+$/', (string)$val)) {
				$val_int = (int)$val;
				if ($val_int >= 1) { $limit = $val_int; }
			}
		}
		$search = (isset($_GET['search']) && is_scalar($_GET['search'])) ? strip_tags($_GET['search']) : null;
		$offset = ($page - 1) * $limit;

		if (!$type || !isset($path_config[$type])) {
			respond_error('Invalid item type for listing.');
		}
		$table_name = $db->real_escape_string($type);

		$where_clauses = [];
		$params = [];
		$types_str = '';

		if (!empty($search)) {
			$search_term = "%" . $db->real_escape_string($search) . "%";
			$search_fields = ['name'];
			if ($type === 'covers') {
				$search_fields = ['name', 'caption', 'keywords', 'categories'];
			} elseif ($type === 'elements' || $type === 'overlays' || $type === 'templates') {
				$search_fields = ['name', 'keywords'];
			}
			$field_searches = [];
			foreach ($search_fields as $field) {
				$field_searches[] = "`" . $db->real_escape_string($field) . "` LIKE ?";
				$params[] = $search_term;
				$types_str .= 's';
			}
			if (!empty($field_searches)) {
				$where_clauses[] = "(" . implode(" OR ", $field_searches) . ")";
			}
		}
		$where_sql = !empty($where_clauses) ? "WHERE " . implode(" AND ", $where_clauses) : "";

		$count_sql = "SELECT COUNT(*) as total FROM `{$table_name}` {$where_sql}";
		$total_items = 0;
		if ($stmt_count = $db->prepare($count_sql)) {
			if (!empty($params)) {
				$stmt_count->bind_param($types_str, ...$params);
			}
			if ($stmt_count->execute()) {
				$result_count = $stmt_count->get_result();
				$total_items = $result_count->fetch_assoc()['total'] ?? 0;
			} else {
				respond_error('Error counting items: ' . $stmt_count->error);
			}
			$stmt_count->close();
		} else {
			respond_error('DB prepare error (count): ' . $db->error);
		}

		// For templates, we don't need json_content in list view to save bandwidth
		$select_fields = "*";
		if ($type === 'templates') {
			// Explicitly list fields, excluding json_content for list view
			$select_fields = "id, name, thumbnail_path, keywords, created_at, updated_at";
		}

		$sql = "SELECT {$select_fields} FROM `{$table_name}` {$where_sql} ORDER BY id DESC LIMIT ? OFFSET ?";
		$items = [];
		if ($stmt = $db->prepare($sql)) {
			$current_params = $params;
			$current_params[] = $limit;
			$current_params[] = $offset;
			$current_types_str = $types_str . 'ii';

			if (!empty($current_params)) { // Check if there are params to bind
				$stmt->bind_param($current_types_str, ...$current_params);
			}


			if ($stmt->execute()) {
				$result = $stmt->get_result();
				while ($row = $result->fetch_assoc()) {
					if (isset($row['thumbnail_path'])) $row['thumbnail_url'] = $row['thumbnail_path'];
					if (isset($row['image_path'])) $row['image_url'] = $row['image_path']; // For non-templates

					if (isset($row['keywords']) && is_string($row['keywords'])) {
						$row['keywords'] = json_decode($row['keywords'], true) ?: [];
					}
					if (isset($row['categories']) && is_string($row['categories'])) { // For covers
						$row['categories'] = json_decode($row['categories'], true) ?: [];
					}
					$items[] = $row;
				}
			} else {
				respond_error('Error fetching items: ' . $stmt->error);
			}
			$stmt->close();
		} else {
			respond_error('DB prepare error (list): ' . $db->error);
		}

		$pagination_data = [
			'totalItems' => (int)$total_items,
			'itemsPerPage' => (int)$limit,
			'currentPage' => (int)$page,
			'totalPages' => ($limit > 0) ? ceil($total_items / $limit) : 0
		];
		respond_success(ucfirst($type) . ' listed successfully.', ['items' => $items, 'pagination' => $pagination_data]);
	}

	function handle_upload_item($db, $item_type, $path_config) {
		// ... (existing function)
		if (!$item_type || !isset($path_config[$item_type])) {
			respond_error('Invalid item type for upload.');
		}
		$config = $path_config[$item_type];

		$name = (isset($_POST['name']) && is_scalar($_POST['name'])) ? strip_tags($_POST['name']) : null;
		if (empty($name)) {
			respond_error('Name is required.');
		}

		$keywords_str = (isset($_POST['keywords']) && is_scalar($_POST['keywords'])) ? strip_tags($_POST['keywords']) : '';
		$keywords_json = !empty($keywords_str) ? json_encode(array_map('trim', explode(',', $keywords_str))) : '[]';

		$original_file_url = null;
		$thumbnail_file_url = null;
		$original_file_path_on_server = null;
		$thumbnail_file_path_on_server = null;
		$json_content_str = null;

		$image_file_key = ($item_type === 'templates') ? 'thumbnail_file' : 'image_file';

		if (isset($_FILES[$image_file_key]) && $_FILES[$image_file_key]['error'] === UPLOAD_ERR_OK) {
			$uploaded_file = $_FILES[$image_file_key];
			$file_ext = strtolower(pathinfo($uploaded_file['name'], PATHINFO_EXTENSION));
			$allowed_img_ext = ['jpg', 'jpeg', 'png', 'gif'];
			if (!in_array($file_ext, $allowed_img_ext)) {
				respond_error('Invalid image file type. Allowed: JPG, PNG, GIF.');
			}

			$sanitized_original_filename = sanitize_filename(pathinfo($uploaded_file['name'], PATHINFO_FILENAME)); // Sanitize base name
			$unique_filename_base = uniqid($item_type . '_', true) . '_' . $sanitized_original_filename . '.' . $file_ext; // Re-add extension

			$target_dir_originals = ($item_type === 'templates') ? $config['thumbnails'] : $config['originals'];
			$target_dir_thumbnails = $config['thumbnails'];

			$original_file_path_on_server = rtrim($target_dir_originals, '/') . '/' . $unique_filename_base;
			$original_file_url = rtrim((($item_type === 'templates') ? $config['thumbnails_url'] : $config['originals_url']), '/') . '/' . $unique_filename_base;

			if (!move_uploaded_file($uploaded_file['tmp_name'], $original_file_path_on_server)) {
				respond_error('Failed to move uploaded image file to: ' . htmlspecialchars($original_file_path_on_server));
			}

			if ($item_type !== 'templates') { // Covers, Elements, Overlays
				$thumb_sanitized_filename = sanitize_filename(pathinfo($uploaded_file['name'], PATHINFO_FILENAME));
				$thumbnail_filename = 'thumb_' . uniqid('', true) . '_' . $thumb_sanitized_filename . '.' . $file_ext;

				$thumbnail_file_path_on_server = rtrim($target_dir_thumbnails, '/') . '/' . $thumbnail_filename;
				if (create_thumbnail($original_file_path_on_server, $thumbnail_file_path_on_server, $config['thumb_w'], $config['thumb_h'], THUMBNAIL_QUALITY)) {
					$thumbnail_file_url = rtrim($config['thumbnails_url'], '/') . '/' . $thumbnail_filename;
				} else {
					if (file_exists($original_file_path_on_server)) @unlink($original_file_path_on_server);
					respond_error('Failed to create thumbnail.');
				}
			} else { // Templates: uploaded image is the thumbnail
				$thumbnail_file_url = $original_file_url;
				$thumbnail_file_path_on_server = $original_file_path_on_server; // Path is the same
			}
		} elseif ($item_type !== 'templates' && (!isset($_FILES[$image_file_key]) || $_FILES[$image_file_key]['error'] !== UPLOAD_ERR_OK) ) {
			respond_error('Image file is required for ' . $item_type);
		} elseif ($item_type === 'templates' && (!isset($_FILES[$image_file_key]) || $_FILES[$image_file_key]['error'] !== UPLOAD_ERR_OK) ) {
			respond_error('Thumbnail file is required for templates');
		}


		$sql = "";
		$types = "";
		$params = [];

		if ($item_type === 'covers') {
			$caption = (isset($_POST['caption']) && is_scalar($_POST['caption'])) ? strip_tags($_POST['caption']) : null;
			$categories_str = (isset($_POST['categories']) && is_scalar($_POST['categories'])) ? strip_tags($_POST['categories']) : '';
			$categories_json = !empty($categories_str) ? json_encode(array_map('trim', explode(',', $categories_str))) : '[]';
			$sql = "INSERT INTO `covers` (name, thumbnail_path, image_path, caption, keywords, categories) VALUES (?, ?, ?, ?, ?, ?)";
			$types = "ssssss";
			$params = [$name, $thumbnail_file_url, $original_file_url, $caption, $keywords_json, $categories_json];
		} elseif ($item_type === 'elements' || $item_type === 'overlays') {
			$sql = "INSERT INTO `{$db->real_escape_string($item_type)}` (name, thumbnail_path, image_path, keywords) VALUES (?, ?, ?, ?)";
			$types = "ssss";
			$params = [$name, $thumbnail_file_url, $original_file_url, $keywords_json];
		} elseif ($item_type === 'templates') {
			if (!isset($_FILES['json_file']) || $_FILES['json_file']['error'] !== UPLOAD_ERR_OK) {
				if ($original_file_path_on_server && file_exists($original_file_path_on_server)) @unlink($original_file_path_on_server);
				respond_error('JSON file upload error: ' . ($_FILES['json_file']['error'] ?? 'No file uploaded'));
			}
			$json_file = $_FILES['json_file'];
			if (strtolower(pathinfo($json_file['name'], PATHINFO_EXTENSION)) !== 'json') {
				if ($original_file_path_on_server && file_exists($original_file_path_on_server)) @unlink($original_file_path_on_server);
				respond_error('Invalid JSON file type. Must be .json.');
			}
			$json_content_str = file_get_contents($json_file['tmp_name']);
			$json_data = json_decode($json_content_str);
			if (json_last_error() !== JSON_ERROR_NONE) {
				if ($original_file_path_on_server && file_exists($original_file_path_on_server)) @unlink($original_file_path_on_server);
				respond_error('Invalid JSON content: ' . json_last_error_msg());
			}
			$sql = "INSERT INTO `templates` (name, thumbnail_path, json_content, keywords) VALUES (?, ?, ?, ?)";
			$types = "ssss";
			$params = [$name, $thumbnail_file_url, $json_content_str, $keywords_json];
		} else {
			respond_error('Unhandled item type for upload.');
		}

		if ($stmt = $db->prepare($sql)) {
			$stmt->bind_param($types, ...$params);
			if ($stmt->execute()) {
				respond_success(ucfirst($item_type) . ' uploaded successfully.', ['id' => $stmt->insert_id]);
			} else {
				// Cleanup uploaded files if DB insert fails
				if ($original_file_path_on_server && file_exists($original_file_path_on_server)) @unlink($original_file_path_on_server);
				if ($thumbnail_file_path_on_server && file_exists($thumbnail_file_path_on_server) && $thumbnail_file_path_on_server !== $original_file_path_on_server) @unlink($thumbnail_file_path_on_server);
				respond_error('Database error on upload: ' . $stmt->error);
			}
			$stmt->close();
		} else {
			if ($original_file_path_on_server && file_exists($original_file_path_on_server)) @unlink($original_file_path_on_server);
			if ($thumbnail_file_path_on_server && file_exists($thumbnail_file_path_on_server) && $thumbnail_file_path_on_server !== $original_file_path_on_server) @unlink($thumbnail_file_path_on_server);
			respond_error("DB prepare error ({$item_type}): " . $db->error);
		}
	}

	function handle_delete_item($db, $item_type, $path_config, $id) {
		// ... (existing function)
		if (!$id && $id !== 0) { // ID can be 0 if auto_increment starts there, though unusual.
			respond_error('Invalid ID for deletion.');
		}
		if (!$item_type || !isset($path_config[$item_type])) {
			respond_error('Invalid item type for deletion.');
		}
		$table_name = $db->real_escape_string($item_type);

		// First, select the item to get file paths
		$stmt_select = $db->prepare("SELECT * FROM `{$table_name}` WHERE id = ?");
		if (!$stmt_select) respond_error("DB prepare select error: " . $db->error);
		$stmt_select->bind_param("i", $id);
		$stmt_select->execute();
		$result = $stmt_select->get_result();
		$item = $result->fetch_assoc();
		$stmt_select->close();

		if (!$item) {
			// Item might have been already deleted, or ID is wrong.
			// Respond with success to avoid user confusion if it's already gone.
			respond_success(ucfirst($item_type) . ' not found or already deleted.');
			return;
		}

		// Then, delete the item from DB
		$stmt_delete = $db->prepare("DELETE FROM `{$table_name}` WHERE id = ?");
		if (!$stmt_delete) respond_error("DB prepare delete error: " . $db->error);
		$stmt_delete->bind_param("i", $id);

		if ($stmt_delete->execute()) {
			if ($stmt_delete->affected_rows > 0) {
				delete_associated_files($item, $item_type, $path_config);
				respond_success(ucfirst($item_type) . ' deleted successfully.');
			} else {
				// This case should ideally be caught by the select above, but as a safeguard:
				respond_success(ucfirst($item_type) . ' not found or already deleted (no rows affected).');
			}
		} else {
			respond_error('Database error on deletion: ' . $stmt_delete->error);
		}
		$stmt_delete->close();
	}

	function handle_get_item_details($db, $item_type, $id) {
		// ... (existing function - ensure json_content is returned for templates)
		if (!$id && $id !== 0) {
			respond_error('Invalid ID for fetching details.');
		}
		if (!$item_type || !in_array($item_type, ['covers', 'elements', 'overlays', 'templates'])) {
			respond_error('Invalid item type for fetching details.');
		}
		$table_name = $db->real_escape_string($item_type);

		$stmt = $db->prepare("SELECT * FROM `{$table_name}` WHERE id = ?");
		if (!$stmt) respond_error("DB prepare error (get details): " . $db->error);
		$stmt->bind_param("i", $id);

		if ($stmt->execute()) {
			$result = $stmt->get_result();
			$item = $result->fetch_assoc();
			$result->free();
			$stmt->close();

			if ($item) {
				// Convert keywords JSON string to comma-separated string for form display
				if (isset($item['keywords']) && is_string($item['keywords'])) {
					$keywords_arr = json_decode($item['keywords'], true) ?: [];
					$item['keywords'] = implode(', ', $keywords_arr);
				} else {
					$item['keywords'] = ''; // Ensure it's a string if null or not set
				}

				// Convert categories JSON string to comma-separated string for form display (Covers only)
				if ($item_type === 'covers' && isset($item['categories']) && is_string($item['categories'])) {
					$categories_arr = json_decode($item['categories'], true) ?: [];
					$item['categories'] = implode(', ', $categories_arr);
				} elseif ($item_type === 'covers') {
					$item['categories'] = '';
				}

				// Add full URLs for images/thumbnails
				if (isset($item['thumbnail_path'])) $item['thumbnail_url'] = $item['thumbnail_path']; // Assuming paths are stored as full URLs
				if (isset($item['image_path'])) $item['image_url'] = $item['image_path']; // Assuming paths are stored as full URLs

				// For templates, json_content is already selected by SELECT *
				// No special processing needed here for json_content for the modal, JS will handle it.

				respond_success('Item details fetched.', $item);
			} else {
				respond_error(ucfirst($item_type) . ' not found.', [], 404);
			}
		} else {
			respond_error('Error fetching item details: ' . $stmt->error);
		}
	}

	function handle_update_item($db, $item_type, $path_config, $id) {
		// ... (existing function)
		if (!$id && $id !== 0) {
			respond_error('Invalid ID for update.');
		}
		if (!$item_type || !isset($path_config[$item_type])) {
			respond_error('Invalid item type for update.');
		}
		$config = $path_config[$item_type];
		$table_name = $db->real_escape_string($item_type);

		// Fetch existing item
		$stmt_select = $db->prepare("SELECT * FROM `{$table_name}` WHERE id = ?");
		if (!$stmt_select) respond_error("DB prepare select error (update): " . $db->error);
		$stmt_select->bind_param("i", $id);
		$stmt_select->execute();
		$result = $stmt_select->get_result();
		$existing_item = $result->fetch_assoc();
		$stmt_select->close();

		if (!$existing_item) {
			respond_error(ucfirst($item_type) . ' not found for update.', [], 404);
		}

		// Common fields
		$name = (isset($_POST['name']) && is_scalar($_POST['name'])) ? strip_tags($_POST['name']) : $existing_item['name'];
		if (empty($name)) {
			respond_error('Name is required.');
		}
		$keywords_str = (isset($_POST['keywords']) && is_scalar($_POST['keywords'])) ? strip_tags($_POST['keywords']) : '';
		$keywords_json = !empty($keywords_str) ? json_encode(array_map('trim', explode(',', $keywords_str))) : ($existing_item['keywords'] ?? '[]');


		// Type-specific fields
		$caption = $existing_item['caption'] ?? null;
		$categories_json = $existing_item['categories'] ?? '[]';
		$json_content_str = $existing_item['json_content'] ?? null; // For templates

		if ($item_type === 'covers') {
			$caption = (isset($_POST['caption']) && is_scalar($_POST['caption'])) ? strip_tags($_POST['caption']) : $existing_item['caption'];
			$categories_str = (isset($_POST['categories']) && is_scalar($_POST['categories'])) ? strip_tags($_POST['categories']) : '';
			$categories_json = !empty($categories_str) ? json_encode(array_map('trim', explode(',', $categories_str))) : ($existing_item['categories'] ?? '[]');
		}

		// File handling
		$original_file_url = $existing_item['image_path'] ?? null;
		$thumbnail_file_url = $existing_item['thumbnail_path'] ?? null;
		$files_to_delete_later = [];

		$image_file_key = ($item_type === 'templates') ? 'thumbnail_file' : 'image_file'; // 'thumbnail_file' for templates, 'image_file' for others

		if (isset($_FILES[$image_file_key]) && $_FILES[$image_file_key]['error'] === UPLOAD_ERR_OK) {
			$uploaded_file = $_FILES[$image_file_key];
			// Basic validation
			$file_ext = strtolower(pathinfo($uploaded_file['name'], PATHINFO_EXTENSION));
			$allowed_img_ext = ['jpg', 'jpeg', 'png', 'gif'];
			if (!in_array($file_ext, $allowed_img_ext)) {
				respond_error('Invalid replacement image file type. Allowed: JPG, PNG, GIF.');
			}

			// Add old files to delete list
			if ($item_type !== 'templates' && !empty($existing_item['image_path'])) {
				$files_to_delete_later[] = $existing_item['image_path'];
			}
			if (!empty($existing_item['thumbnail_path'])) { // Always add old thumbnail
				$files_to_delete_later[] = $existing_item['thumbnail_path'];
			}

			$sanitized_original_filename = sanitize_filename(pathinfo($uploaded_file['name'], PATHINFO_FILENAME));
			$unique_filename_base_new = uniqid($item_type . '_update_', true) . '_' . $sanitized_original_filename . '.' . $file_ext;

			$target_dir_for_new_original = ($item_type === 'templates') ? $config['thumbnails'] : $config['originals'];
			$target_url_for_new_original = ($item_type === 'templates') ? $config['thumbnails_url'] : $config['originals_url'];

			$new_original_file_path_on_server = rtrim($target_dir_for_new_original, '/') . '/' . $unique_filename_base_new;

			if (!move_uploaded_file($uploaded_file['tmp_name'], $new_original_file_path_on_server)) {
				respond_error('Failed to move updated image file.');
			}
			$original_file_url = rtrim($target_url_for_new_original, '/') . '/' . $unique_filename_base_new; // This is the new main image or new template thumbnail

			if ($item_type !== 'templates') { // Create new thumbnail for Covers, Elements, Overlays
				$thumb_sanitized_filename_new = sanitize_filename(pathinfo($uploaded_file['name'], PATHINFO_FILENAME));
				$new_thumbnail_filename = 'thumb_' . uniqid('', true) . '_' . $thumb_sanitized_filename_new . '.' . $file_ext;
				$new_thumbnail_file_path_on_server = rtrim($config['thumbnails'], '/') . '/' . $new_thumbnail_filename;

				if (create_thumbnail($new_original_file_path_on_server, $new_thumbnail_file_path_on_server, $config['thumb_w'], $config['thumb_h'], THUMBNAIL_QUALITY)) {
					$thumbnail_file_url = rtrim($config['thumbnails_url'], '/') . '/' . $new_thumbnail_filename;
				} else {
					if (file_exists($new_original_file_path_on_server)) @unlink($new_original_file_path_on_server); // Clean up new original if thumb fails
					respond_error('Failed to create new thumbnail for update.');
				}
			} else { // For templates, the uploaded file IS the new thumbnail
				$thumbnail_file_url = $original_file_url; // $original_file_url already points to the new thumbnail
			}
		}

		// JSON file update for templates
		if ($item_type === 'templates' && isset($_FILES['json_file']) && $_FILES['json_file']['error'] === UPLOAD_ERR_OK) {
			$json_file = $_FILES['json_file'];
			if (strtolower(pathinfo($json_file['name'], PATHINFO_EXTENSION)) !== 'json') {
				respond_error('Invalid JSON file type for update. Must be .json.');
			}
			$new_json_content_str = file_get_contents($json_file['tmp_name']);
			if (json_decode($new_json_content_str) === null && json_last_error() !== JSON_ERROR_NONE) {
				respond_error('Invalid JSON content in update: ' . json_last_error_msg());
			}
			$json_content_str = $new_json_content_str; // Update with new content
		}

		// Build SQL Update
		$sql_update = "";
		$types_update = "";
		$params_update = [];

		if ($item_type === 'covers') {
			$sql_update = "UPDATE `covers` SET name = ?, thumbnail_path = ?, image_path = ?, caption = ?, keywords = ?, categories = ? WHERE id = ?";
			$types_update = "ssssssi";
			$params_update = [$name, $thumbnail_file_url, $original_file_url, $caption, $keywords_json, $categories_json, $id];
		} elseif ($item_type === 'elements' || $item_type === 'overlays') {
			$sql_update = "UPDATE `{$table_name}` SET name = ?, thumbnail_path = ?, image_path = ?, keywords = ? WHERE id = ?";
			$types_update = "ssssi";
			$params_update = [$name, $thumbnail_file_url, $original_file_url, $keywords_json, $id];
		} elseif ($item_type === 'templates') {
			$sql_update = "UPDATE `templates` SET name = ?, thumbnail_path = ?, json_content = ?, keywords = ? WHERE id = ?";
			$types_update = "ssssi";
			$params_update = [$name, $thumbnail_file_url, $json_content_str, $keywords_json, $id];
		} else {
			respond_error('Unhandled item type for update.');
		}

		if ($stmt_update = $db->prepare($sql_update)) {
			$stmt_update->bind_param($types_update, ...$params_update);
			if ($stmt_update->execute()) {
				// Delete old files AFTER successful DB update
				foreach ($files_to_delete_later as $file_url_to_delete) {
					// Ensure we don't delete a file that's still in use (e.g. if thumb wasn't replaced but image was, or vice-versa)
					// This check is important if original_file_url or thumbnail_file_url could be the same as one of the old files
					$path_to_delete = get_server_path_from_url($file_url_to_delete);
					$current_original_path = $original_file_url ? get_server_path_from_url($original_file_url) : null;
					$current_thumbnail_path = $thumbnail_file_url ? get_server_path_from_url($thumbnail_file_url) : null;

					if ($path_to_delete && file_exists($path_to_delete)) {
						$is_still_in_use = ($path_to_delete === $current_original_path) || ($path_to_delete === $current_thumbnail_path);
						if (!$is_still_in_use) {
							@unlink($path_to_delete);
						}
					}
				}
				respond_success(ucfirst($item_type) . ' updated successfully.');
			} else {
				// Cleanup newly uploaded files if DB update fails
				if (isset($new_original_file_path_on_server) && file_exists($new_original_file_path_on_server)) @unlink($new_original_file_path_on_server);
				if (isset($new_thumbnail_file_path_on_server) && file_exists($new_thumbnail_file_path_on_server) && $new_thumbnail_file_path_on_server !== $new_original_file_path_on_server) @unlink($new_thumbnail_file_path_on_server);
				respond_error('Database error on update: ' . $stmt_update->error);
			}
			$stmt_update->close();
		} else {
			// Cleanup newly uploaded files if DB prepare fails
			if (isset($new_original_file_path_on_server) && file_exists($new_original_file_path_on_server)) @unlink($new_original_file_path_on_server);
			if (isset($new_thumbnail_file_path_on_server) && file_exists($new_thumbnail_file_path_on_server) && $new_thumbnail_file_path_on_server !== $new_original_file_path_on_server) @unlink($new_thumbnail_file_path_on_server);
			respond_error("DB prepare error (update {$item_type}): " . $db->error);
		}
	}

	function handle_generate_ai_metadata($db, $item_type, $id, $path_config) {
		// ... (existing function)
		if (!$id && $id !== 0) {
			respond_error('Invalid ID for AI metadata generation.');
		}
		if (!$item_type || !isset($path_config[$item_type])) {
			respond_error('Invalid item type for AI metadata generation.');
		}
		if (empty($_ENV['OPEN_AI_API_KEY'])) {
			respond_error('OpenAI API Key is not configured on the server.');
		}

		$table_name = $db->real_escape_string($item_type);

		// 1. Fetch item
		$stmt_select = $db->prepare("SELECT * FROM `{$table_name}` WHERE id = ?");
		if (!$stmt_select) respond_error("DB prepare select error: " . $db->error);
		$stmt_select->bind_param("i", $id);
		$stmt_select->execute();
		$result = $stmt_select->get_result();
		$item = $result->fetch_assoc();
		$stmt_select->close();

		if (!$item) {
			respond_error(ucfirst($item_type) . ' not found.', [], 404);
		}

		// 2. Determine image path
		$image_url_for_ai = null;
		if ($item_type === 'templates') {
			$image_url_for_ai = $item['thumbnail_path'] ?? null;
		} else {
			$image_url_for_ai = $item['image_path'] ?? $item['thumbnail_path'] ?? null;
		}

		if (!$image_url_for_ai) {
			respond_error('No image found for this item to send to AI.');
		}
		$server_image_path = get_server_path_from_url($image_url_for_ai);
		if (!$server_image_path || !file_exists($server_image_path)) {
			respond_error('Image file not found on server: ' . htmlspecialchars($server_image_path ?? 'path not resolved') . ' (URL: ' . htmlspecialchars($image_url_for_ai) . ')');
		}

		// 3. Read image, base64 encode
		$image_content = @file_get_contents($server_image_path);
		if ($image_content === false) {
			respond_error('Could not read image file: ' . htmlspecialchars($server_image_path));
		}
		$base64_image = base64_encode($image_content);
		$finfo = new finfo(FILEINFO_MIME_TYPE);
		$mime_type = $finfo->file($server_image_path) ?: 'image/jpeg';

		// 4. Define Prompts & Call AI
		$common_keywords_prompt = "Generate a list of 10-15 relevant keywords for this image, suitable for search or tagging. Include single words and relevant two-word phrases. Focus on visual elements, style, and potential use case. Output only a comma-separated list.";
		$ai_generated_data = [];

		local_log("AI: Requesting keywords for {$item_type} ID {$id}");
		$keywords_response = generate_metadata_from_image_base64($common_keywords_prompt, $base64_image, $mime_type, 'gpt-4o-mini'); // Use a cost-effective model
		if (isset($keywords_response['content'])) {
			$parsed_keywords = parse_ai_list_response($keywords_response['content']);
			if (!empty($parsed_keywords)) {
				$ai_generated_data['keywords'] = json_encode($parsed_keywords);
				local_log("AI: Keywords for {$item_type} ID {$id}: " . $ai_generated_data['keywords']);
			} else {
				local_log("AI: Empty keywords after parsing for {$item_type} ID {$id}. Response: " . $keywords_response['content']);
			}
		} elseif (isset($keywords_response['error'])) {
			local_log("AI: Error generating keywords for {$item_type} ID {$id}: " . $keywords_response['error']);
			// Decide if this is fatal. For now, continue if other fields might succeed.
		}

		if ($item_type === 'covers') {
			$caption_prompt = "Describe this book cover image concisely for use as an alt text or short caption. Focus on the main visual elements and mood. Do not include or describe any text visible on the image. Maximum 140 characters.";
			local_log("AI: Requesting caption for cover ID {$id}");
			$caption_response = generate_metadata_from_image_base64($caption_prompt, $base64_image, $mime_type, 'gpt-4o-mini');
			if (isset($caption_response['content'])) {
				$ai_generated_data['caption'] = trim($caption_response['content']);
				if (strlen($ai_generated_data['caption']) > 255) {
					$ai_generated_data['caption'] = substr($ai_generated_data['caption'], 0, 252) . '...';
				}
				local_log("AI: Caption for cover ID {$id}: " . $ai_generated_data['caption']);
			} elseif (isset($caption_response['error'])) {
				local_log("AI: Error generating caption for cover ID {$id}: " . $caption_response['error']);
			}

			$categories_prompt = "Categorize this book cover image into 1-3 relevant genres from the following list: Mystery, Thriller & Suspense, Fantasy, Science Fiction, Horror, Romance, Erotica, Children's, Action & Adventure, Chick Lit, Historical Fiction, Literary Fiction, Teen & Young Adult, Royal Romance, Western, Surreal, Paranormal & Urban, Apocalyptic, Nature, Poetry, Travel, Religion & Spirituality, Business, Self-Improvement, Education, Health & Wellness, Cookbooks & Food, Environment, Politics & Society, Family & Parenting, Abstract, Medical, Fitness, Sports, Science, Music. Output only a comma-separated list of the chosen categories.";
			local_log("AI: Requesting categories for cover ID {$id}");
			$categories_response = generate_metadata_from_image_base64($categories_prompt, $base64_image, $mime_type, 'gpt-4o-mini');
			if (isset($categories_response['content'])) {
				$parsed_categories = parse_ai_list_response($categories_response['content']);
				if (!empty($parsed_categories)) {
					$ai_generated_data['categories'] = json_encode($parsed_categories);
					local_log("AI: Categories for cover ID {$id}: " . $ai_generated_data['categories']);
				} else {
					local_log("AI: Empty categories after parsing for cover ID {$id}. Response: " . $categories_response['content']);
				}
			} elseif (isset($categories_response['error'])) {
				local_log("AI: Error generating categories for cover ID {$id}: " . $categories_response['error']);
			}
		}

		if (empty($ai_generated_data)) {
			respond_error('AI did not return any usable metadata or an error occurred. Check logs.');
		}

		// 5. Build SQL Update Query
		$set_clauses = [];
		$update_params = [];
		$update_types = "";

		if (isset($ai_generated_data['keywords'])) {
			$set_clauses[] = "keywords = ?";
			$update_params[] = $ai_generated_data['keywords'];
			$update_types .= "s";
		}
		if ($item_type === 'covers') {
			if (isset($ai_generated_data['caption'])) {
				$set_clauses[] = "caption = ?";
				$update_params[] = $ai_generated_data['caption'];
				$update_types .= "s";
			}
			if (isset($ai_generated_data['categories'])) {
				$set_clauses[] = "categories = ?";
				$update_params[] = $ai_generated_data['categories'];
				$update_types .= "s";
			}
		}

		if (empty($set_clauses)) {
			respond_success('No new metadata generated by AI to update, or all AI requests failed.', ['no_changes' => true]);
			return;
		}

		$sql_update_ai = "UPDATE `{$table_name}` SET " . implode(", ", $set_clauses) . " WHERE id = ?";
		$update_params[] = $id;
		$update_types .= "i";

		if ($stmt_update_ai = $db->prepare($sql_update_ai)) {
			$stmt_update_ai->bind_param($update_types, ...$update_params);
			if ($stmt_update_ai->execute()) {
				respond_success(ucfirst($item_type) . ' metadata updated successfully by AI.');
			} else {
				respond_error('Database error updating with AI metadata: ' . $stmt_update_ai->error);
			}
			$stmt_update_ai->close();
		} else {
			respond_error("DB prepare error (AI update {$item_type}): " . $db->error);
		}
	}


// --- NEW: AI SIMILAR TEMPLATE GENERATION HANDLER ---
	function handle_generate_similar_template($db, $original_template_id) {
		if (!$original_template_id && $original_template_id !== 0) {
			respond_error('Invalid Original Template ID for AI generation.');
		}
		if (empty($_ENV['OPEN_AI_API_KEY'])) {
			respond_error('OpenAI API Key is not configured on the server.');
		}

		$user_prompt_text = isset($_POST['user_prompt']) ? strip_tags($_POST['user_prompt']) : '';
		if (empty($user_prompt_text)) {
			respond_error('User prompt is required.');
		}

		// Option 1: Get original JSON from POST (sent by JS)
		$original_json_content = isset($_POST['original_json_content']) ? $_POST['original_json_content'] : null;

		// Option 2: Or fetch from DB if not provided or to ensure freshness (safer)
		if (!$original_json_content) {
			$stmt_select = $db->prepare("SELECT json_content, name FROM `templates` WHERE id = ?");
			if (!$stmt_select) respond_error("DB prepare select error: " . $db->error);
			$stmt_select->bind_param("i", $original_template_id);
			$stmt_select->execute();
			$result = $stmt_select->get_result();
			$original_template_item = $result->fetch_assoc();
			$stmt_select->close();

			if (!$original_template_item || empty($original_template_item['json_content'])) {
				respond_error('Original template not found or has no JSON content.', [], 404);
			}
			$original_json_content = $original_template_item['json_content'];
		}
		// Validate original JSON before sending to AI
		json_decode($original_json_content);
		if (json_last_error() !== JSON_ERROR_NONE) {
			respond_error('Original template content is not valid JSON: ' . json_last_error_msg());
		}


		// Construct prompt for OpenAI
		$system_message = "You are an expert JSON template designer. Based on the provided example JSON and the user's request, generate a new, complete, and valid JSON object.
The output MUST be ONLY the raw JSON content, without any surrounding text, explanations, or markdown ```json ... ``` tags.
Ensure all structural elements from the example are considered and adapted according to the user's request.";

		$user_message_content = "User Request: \"{$user_prompt_text}\"\n\nExample JSON:\n{$original_json_content}";

		$messages = [
			["role" => "system", "content" => $system_message],
			["role" => "user", "content" => $user_message_content]
		];

		local_log("AI Similar Template: Requesting generation for template ID {$original_template_id}. User prompt: {$user_prompt_text}");

		// Using gpt-4o as it's powerful. Max tokens might need adjustment based on typical template size.
		$ai_response = call_openAI_question($messages, 0.6, 4000, 'gpt-4o');

		if (isset($ai_response['error'])) {
			local_log("AI Similar Template: Error for ID {$original_template_id}: " . $ai_response['error']);
			respond_error("AI Error: " . $ai_response['error']);
		}

		$generated_json_string = $ai_response['content'];
		local_log("AI Similar Template: Raw response for ID {$original_template_id}: " . $generated_json_string);

		// Validate AI response as JSON
		// Sometimes AI might still wrap in ```json ... ``` despite instructions
		if (preg_match('/```json\s*([\s\S]*?)\s*```/', $generated_json_string, $matches)) {
			$generated_json_string = $matches[1];
		}
		$generated_json_string = trim($generated_json_string);


		$decoded_json = json_decode($generated_json_string);
		if (json_last_error() !== JSON_ERROR_NONE) {
			local_log("AI Similar Template: Invalid JSON response for ID {$original_template_id}. Error: " . json_last_error_msg() . ". Raw: " . $ai_response['content']);
			respond_error('AI returned invalid JSON: ' . json_last_error_msg() . ". Please try rephrasing your prompt or try again. Raw AI output: " . htmlspecialchars(substr($ai_response['content'],0, 200))."...");
		}

		// Save to file
		$ai_templates_dir = ADMIN_AI_TEMPLATES_DIR; // Defined in admin_config.php
		if (!is_dir($ai_templates_dir)) {
			if (!@mkdir($ai_templates_dir, 0775, true)) {
				local_log("AI Similar Template: Failed to create directory {$ai_templates_dir}");
				respond_error('Could not create directory for AI-generated templates.');
			}
		}

		$timestamp = time();
		$filename = "template_ai_origID{$original_template_id}_{$timestamp}.json";
		$filepath = $ai_templates_dir . '/' . $filename;

		// Use json_encode to re-format/pretty-print the validated JSON for saving
		$pretty_json_to_save = json_encode($decoded_json, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

		if (file_put_contents($filepath, $pretty_json_to_save) === false) {
			local_log("AI Similar Template: Failed to write file {$filepath}");
			respond_error('Failed to save AI-generated template file.');
		}

		local_log("AI Similar Template: Successfully generated and saved {$filename}");
		respond_success('AI-generated template file created successfully.', ['filename' => $filename, 'directory' => basename(ADMIN_AI_TEMPLATES_DIR)]);
	}


	$mysqlDBConn->close();
?>
