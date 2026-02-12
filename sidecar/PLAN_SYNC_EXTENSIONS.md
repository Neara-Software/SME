# Plan: Add Sync Support for Widgets, DataTables, and DatabaseTables

## Context

The sidecar `dim sync` command currently supports syncing:
- **Types** - Custom field definitions (`.dim` and `.neara.json` files in `Types/` folder)
- **Reports** - Table report definitions (`.neara.json` files in `Reports/` folder)

This plan extends sync support to:
- **Custom Widgets** - UI widget definitions
- **Data Tables** - Static data tables
- **Database Tables** - Custom record collections with associated data

## Current Architecture

### TypeScript Side (tools/sidecar/)

**cli.ts** - Command line interface
- `handleSync()` function parses `--types` and `--reports` flags
- Reads files from disk, organizes by virtual path
- Sends to webapp via `cli.sendRequest('sync', { moduleKey, typeFiles, reportFiles })`

**SyncHandler (Dart)** - Handles `sync` message type in `sidecar_service.dart`
- Receives `{ moduleKey, typeFiles?, reportFiles? }` payload
- Calls `ModuleFileSystemSyncer.loadChangedTypesSimple()` for types
- Calls `ModuleFileSystemSyncer.loadChangedReportsSimple()` for reports

### Dart Side (client/)

**ModuleFileSystemSyncer** (`client/lib/src/model/module/file_system/file_system_sync.dart`)
- Core sync logic for all module content types
- `loadChangedTypesSimple()` - processes Types folder files
- `loadChangedReportsSimple()` - processes Reports folder files
- `_loadModuleFromLocalFileSystemInternal()` - shows patterns for loading all content types

**Existing load patterns in `_loadModuleFromLocalFileSystemInternal()`:**
```dart
// Widgets - line 368-379
for (String fileName in await _listOrEmpty(fileSystem, '$moduleKey/Widgets')) {
  if (!fileName.endsWith('.neara.$preferredSuffix')) continue;
  String widgetString = await fileSystem.readFileAsString('$moduleKey/Widgets/$fileName');
  Map<String, Object> widgetObject = encoder.decode(widgetString);
  CustomWidgetData widget = _rsd.deserializeNamedType(model.ctx, CustomWidgetDataMeta.META, widgetObject);
  model.designModel().raw().getCustomWidgets().insertValue(widget.getLocalId(), widget);
}

// DataTables - line 408-418
for (String fileName in await _listOrEmpty(fileSystem, '$moduleKey/DataTables')) {
  if (!fileName.endsWith('.neara.$preferredSuffix')) continue;
  String tableString = await fileSystem.readFileAsString('$moduleKey/DataTables/$fileName');
  Map<String, Object> tableObject = encoder.decode(tableString);
  DataTableData dataTable = _rsd.deserializeNamedType(model.ctx, DataTableDataMeta.META, tableObject);
  model.designModel().raw().getDataTables().getTables().add(dataTable);
}

// DatabaseTables - line 470-521 (more complex - includes CSV data import)
for (String fileName in await _listOrEmpty(fileSystem, '$moduleKey/DatabaseTables')) {
  // Deserialize table definition
  // Set type reference
  // Import CSV data using CsvUSchemaImporter
}
```

## Implementation Plan

### Commit 1: Add `--widgets` flag to CLI

**File: `tools/sidecar/src/cli.ts`**

In `handleSync()` function:
1. Add `--widgets` argument parsing (same pattern as `--types`):
```typescript
const widgetsIndex = args.indexOf('--widgets');
const widgetsProvided = widgetsIndex !== -1;
let widgetNames: string[] | undefined;
let syncAllWidgets = false;
if (widgetsProvided) {
  // Same pattern as types
}
```

2. Add widgets directory reading:
```typescript
const widgetsDir = nodePath.join(modulePath, 'Widgets');
const widgetFiles: Record<string, string> = {};
if (widgetsProvided && hasWidgetsDir) {
  for (const filename of fs.readdirSync(widgetsDir)) {
    if (!filename.includes('.neara.')) continue;
    // Filter by widgetNames if specified
    const filePath = nodePath.join(widgetsDir, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    const virtualPath = `${moduleKey}/Widgets/${filename}`;
    widgetFiles[virtualPath] = content;
  }
}
```

3. Include in request payload:
```typescript
await cli.sendRequest('sync', {
  moduleKey,
  typeFiles: { [virtualPath]: content },
  widgetFiles: widgetFiles,  // NEW
});
```

4. Update `printUsage()` to document `--widgets` flag.

**File: `client/lib/src/base/util/web/sidecar_service.dart`**

In `SyncHandler.handleRequest()`:
1. Add `widgetFiles` payload extraction:
```dart
Map<String, Object> widgetFilesRaw = payload['widgetFiles'] as Map<String, Object>;
```

2. Add widget sync logic (follow `loadChangedReportsSimple` pattern):
```dart
if (widgetFiles.isNotEmpty) {
  await _syncer.loadChangedWidgetsSimple(
    module: module,
    upsertedFiles: widgetFiles,
    deletedFiles: const <String, String>{},
  );
}
```

**File: `client/lib/src/model/module/file_system/file_system_sync.dart`**

Add `loadChangedWidgetsSimple()` method:
```dart
Future<Null> loadChangedWidgetsSimple({
  @required Module module,
  @required Map<String, String> upsertedFiles,
  @required Map<String, String> deletedFiles,
}) async {
  StringEncoder encoder = await _getEncoderSafely();
  Model model = module.model();
  String moduleKey = module.getKey();
  String preferredSuffix = encoder.getPreferredSuffix();

  for (String widgetFile in upsertedFiles.keys) {
    String widgetFileName = widgetFile.split('/').last;
    if (!widgetFileName.endsWith('.neara.$preferredSuffix')) continue;

    String widgetString = upsertedFiles[widgetFile];
    Map<String, Object> widgetObject = encoder.decode(widgetString);
    CustomWidgetData widget = _rsd.deserializeNamedType(model.ctx, CustomWidgetDataMeta.META, widgetObject);

    // Validate namespace
    // ... (extract namespace from widget name/id, compare to moduleKey)

    // Upsert: remove existing if present, then insert
    if (model.designModel().raw().getCustomWidgets().hasKey(widget.getLocalId())) {
      model.designModel().raw().getCustomWidgets().removeValue(widget.getLocalId());
    }
    model.designModel().raw().getCustomWidgets().insertValue(widget.getLocalId(), widget);
  }

  // Handle deletedFiles...
}
```

---

### Commit 2: Add `--datatables` flag to CLI

**File: `tools/sidecar/src/cli.ts`**

Same pattern as widgets:
1. Add `--datatables` argument parsing
2. Read from `DataTables/` directory
3. Include `dataTableFiles` in request payload

**File: `client/lib/src/base/util/web/sidecar_service.dart`**

Extract and process `dataTableFiles` payload.

**File: `client/lib/src/model/module/file_system/file_system_sync.dart`**

Add `loadChangedDataTablesSimple()` method:
```dart
Future<Null> loadChangedDataTablesSimple({
  @required Module module,
  @required Map<String, String> upsertedFiles,
  @required Map<String, String> deletedFiles,
}) async {
  StringEncoder encoder = await _getEncoderSafely();
  Model model = module.model();
  String preferredSuffix = encoder.getPreferredSuffix();

  for (String tableFile in upsertedFiles.keys) {
    String tableFileName = tableFile.split('/').last;
    if (!tableFileName.endsWith('.neara.$preferredSuffix')) continue;

    String tableString = upsertedFiles[tableFile];
    Map<String, Object> tableObject = encoder.decode(tableString);
    DataTableData dataTable = _rsd.deserializeNamedType(model.ctx, DataTableDataMeta.META, tableObject);

    // Remove existing if present
    model.designModel().raw().getDataTables().getTables()
        .removeWhere((t) => t.getName() == dataTable.getName());
    model.designModel().raw().getDataTables().getTables().add(dataTable);
  }

  // Handle deletedFiles...
}
```

---

### Commit 3: Add `--databasetables` flag to CLI

This is more complex because database tables include:
1. Table definition (schema)
2. Type reference (points to a CustomClass)
3. CSV data (the actual records)

The file format stores all three:
```json
{
  "type_key": "myModule~MyCustomClass",
  "data": "field1,field2\nvalue1,value2\n...",
  // ... other CustomDatabaseTableData fields
}
```

**File: `tools/sidecar/src/cli.ts`**

1. Add `--databasetables` argument parsing
2. Read from `DatabaseTables/` directory
3. Include `databaseTableFiles` in request payload

**File: `client/lib/src/base/util/web/sidecar_service.dart`**

Extract and process `databaseTableFiles` payload.

**File: `client/lib/src/model/module/file_system/file_system_sync.dart`**

Add `loadChangedDatabaseTablesSimple()` method - this needs to:
1. Deserialize the table definition
2. Look up the referenced CustomClass type
3. Import CSV data into the table using `CsvUSchemaImporter`

```dart
Future<Null> loadChangedDatabaseTablesSimple({
  @required Module module,
  @required Map<String, String> upsertedFiles,
  @required Map<String, String> deletedFiles,
}) async {
  StringEncoder encoder = await _getEncoderSafely();
  Model model = module.model();
  String moduleKey = module.getKey();
  String preferredSuffix = encoder.getPreferredSuffix();

  for (String tableFile in upsertedFiles.keys) {
    String fileName = tableFile.split('/').last;
    if (!fileName.endsWith('.neara.$preferredSuffix')) continue;

    String tableStr = upsertedFiles[tableFile];
    Map<String, Object> tableJson = encoder.decode(tableStr);

    String typeKey = STR(tableJson[_DATABASE_TABLE_TYPE_KEY_FIELD]) ?? "";
    String data = STR(tableJson[_DATABASE_TABLE_DATA_FIELD]);

    CustomDatabaseTableData tableData = _rsd.deserializeNamedType(
      model.ctx, CustomDatabaseTableDataMeta.META, tableJson);

    // Upsert table definition
    if (model.designModel().raw().getCustomDatabaseTables().hasKey(tableData.getId())) {
      model.designModel().raw().getCustomDatabaseTables().removeValue(tableData.getId());
    }
    model.designModel().raw().getCustomDatabaseTables().insertValue(tableData.getId(), tableData);

    CustomDatabaseTable table = model.designModel().collectionCustomDatabaseTables()
        .byId(tableData.getId(), onlyValid: false);
    table.setType(Ref.ofKey(typeKey));

    // Import CSV data if present
    UClass<CustomRecord> uClass = table.getType()?.get()?.getUClass();
    if (uClass != null && data != null) {
      CsvUSchemaImporter<CustomRecord> tableImporter = CsvUSchemaImporter.withoutKey(
        createNewObject: table.createNewRecord,
        getRegistry: () => CsvImportColumnRegistry.simple<CustomRecord>(
          uClass,
          getMeasurementSystem: model.measures,
          getExtension: () => model.extension.ensureExtensionFor(uClass),
        ),
      );
      tableImporter.import(data, const {});
    }
  }

  // Handle deletedFiles...
}
```

---

## Testing Verification

For each new sync type:

1. **Export test data:**
   - Use the existing "Export Module to File System" feature in the webapp
   - This creates the correct file format in `Widgets/`, `DataTables/`, `DatabaseTables/`

2. **Modify exported file:**
   - Make a small change to verify sync works

3. **Sync back:**
   ```bash
   dim sync --module <key> --path /path/to/module --widgets all
   dim sync --module <key> --path /path/to/module --datatables all
   dim sync --module <key> --path /path/to/module --databasetables all
   ```

4. **Verify in webapp:**
   - Check that changes appear correctly
   - Verify no data loss or corruption

---

## Dependencies

- Types should be synced BEFORE DatabaseTables (database tables reference custom types)
- The order of sync calls in a single request should be: Types → DatabaseTables → Widgets → DataTables → Reports

---

## Files to Modify (Summary)

| File | Changes |
|------|---------|
| `tools/sidecar/src/cli.ts` | Add `--widgets`, `--datatables`, `--databasetables` flags |
| `client/lib/src/base/util/web/sidecar_service.dart` | Extract and process new file payload types |
| `client/lib/src/model/module/file_system/file_system_sync.dart` | Add `loadChangedWidgetsSimple`, `loadChangedDataTablesSimple`, `loadChangedDatabaseTablesSimple` methods |
