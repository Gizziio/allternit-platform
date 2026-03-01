def validate_ui_registry(registry, path: Path, schemas: dict):
    if "version" not in registry:
        fail(f"UI registry missing version in {path}")
    
    ui_actions = registry.get("ui_actions", [])
    ensure_nonempty_list(ui_actions, f"{path} ui_actions")
    action_ids = set()
    
    # Load gateway registry to validate routes exist
    gateway_registry_path = ROOT / "infra" / "gateway" / "gateway_registry.json"
    gateway_registry = load_json(gateway_registry_path)
    
    # Collect all valid routes from gateway registry
    valid_routes = set()
    external_routes = gateway_registry.get("external_ingress", {}).get("routes", [])
    for route in external_routes:
        valid_routes.add(route.get("path", ""))
    
    services = gateway_registry.get("services", [])
    for service in services:
        service_routes = service.get("routes", [])
        for route in service_routes:
            valid_routes.add(route.get("path", ""))

    for action in ui_actions:
        action_id = action.get("action_id")
        if not action_id:
            fail(f"UI action missing action_id in {path}")
        if action_id in action_ids:
            fail(f"Duplicate action_id '{action_id}' in {path}")
        action_ids.add(action_id)
        
        required_fields = ["name", "description", "gateway_route", "allowed_methods", "requires_auth"]
        for field in required_fields:
            if field not in action:
                fail(f"UI action '{action_id}' missing '{field}' in {path}")
        
        # Validate gateway route format (METHOD:/path)
        gateway_route = action.get("gateway_route", "")
        if "/" not in gateway_route:
            fail(f"UI action '{action_id}' has invalid gateway_route format '{gateway_route}' in {path}")
        
        parts = gateway_route.split("/", 1)
        if len(parts) != 2:
            fail(f"UI action '{action_id}' has invalid gateway_route format '{gateway_route}' in {path}")
        
        method, path_suffix = parts[0], "/" + parts[1]  # Reconstruct the path part
        
        # Validate method
        valid_methods = {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"}
        if method not in valid_methods:
            fail(f"UI action '{action_id}' has invalid HTTP method '{method}' in {path}")
        
        # Validate allowed methods
        allowed_methods = action.get("allowed_methods", [])
        ensure_nonempty_list(allowed_methods, f"{path} allowed_methods for action {action_id}")
        for method in allowed_methods:
            if method not in valid_methods:
                fail(f"UI action '{action_id}' has invalid allowed method '{method}' in {path}")
        
        # Validate that the gateway route exists in the gateway registry
        if path_suffix not in valid_routes:
            fail(f"UI action '{action_id}' references non-existent gateway route '{gateway_route}' in {path}")