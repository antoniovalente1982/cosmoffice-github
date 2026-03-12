-- Migration to align database structure with "Concurrent Capacity" logic
ALTER TABLE workspaces RENAME COLUMN max_members TO max_capacity;
