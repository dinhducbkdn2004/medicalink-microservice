#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO
  \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'medicalink') THEN
      CREATE USER medicalink WITH PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
  END
  \$\$;
EOSQL

# Tạo các database riêng biệt
for DB in medicalink_accounts medicalink_booking medicalink_provider medicalink_content medicalink_notification; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE $DB' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB')\gexec
    GRANT ALL PRIVILEGES ON DATABASE $DB TO medicalink;
EOSQL
done