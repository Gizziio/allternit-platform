//! Migration smoke test: every migration must apply cleanly to a fresh
//! database under sqlx's pragmas (foreign_keys=ON). Catches DDL that only
//! works in the sqlite3 CLI.

#[tokio::test]
async fn migrations_apply_cleanly() {
    let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();

    // BYO-VPS tables exist with the expected shape.
    let (wizard_cols,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM pragma_table_info('wizard_sessions')")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(wizard_cols >= 5);

    let (cred_cols,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM pragma_table_info('provider_tokens')")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(cred_cols, 5);

    // cloud_instances accepts the widened provider set.
    sqlx::query(
        "INSERT INTO cloud_instances (id, server_id, provider, name, region, instance_type, status)
         VALUES ('ci_1', 'srv_1', 'digitalocean', 'test', 'nyc3', 's-1vcpu-2gb', 'running')",
    )
    .execute(&pool)
    .await
    .unwrap();
}
