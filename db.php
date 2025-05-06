<?php
	require_once 'vendor/autoload.php';

	use Dotenv\Dotenv;

	$dotenv = Dotenv::createImmutable(__DIR__);
	$dotenv->load();

	$mysqlDBConn = new mysqli($_ENV["DB_HOST"], $_ENV["DB_USERNAME"], $_ENV["DB_PASSWORD"], $_ENV["DB_DATABASE"]);
	if ($mysqlDBConn->connect_errno) {
		die('Connect Error: ' . $mysqlDBConn->connect_errno);
	}


