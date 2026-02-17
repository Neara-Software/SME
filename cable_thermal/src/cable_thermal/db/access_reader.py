"""Read CYMCAP data from Microsoft Access (.mdb/.accdb) databases.

Uses pyodbc with the Microsoft Access ODBC driver (available on Windows).
"""

from pathlib import Path

import pyodbc


def _connection_string(db_path: Path) -> str:
    """Build an ODBC connection string for an Access database."""
    suffix = db_path.suffix.lower()
    if suffix == ".accdb":
        driver = "Microsoft Access Driver (*.mdb, *.accdb)"
    elif suffix == ".mdb":
        driver = "Microsoft Access Driver (*.mdb, *.accdb)"
    else:
        raise ValueError(f"Unsupported file extension: {suffix}")
    return f"DRIVER={{{driver}}};DBQ={db_path};"


def connect(db_path: str | Path) -> pyodbc.Connection:
    """Open a connection to a CYMCAP Access database.

    Parameters
    ----------
    db_path : str | Path
        Path to the .mdb or .accdb file.

    Returns
    -------
    pyodbc.Connection
        An open ODBC connection.

    Raises
    ------
    FileNotFoundError
        If the database file does not exist.
    pyodbc.Error
        If the ODBC connection fails.
    """
    db_path = Path(db_path)
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")
    conn_str = _connection_string(db_path)
    return pyodbc.connect(conn_str)


def list_tables(conn: pyodbc.Connection) -> list[str]:
    """List all user tables in the database.

    Parameters
    ----------
    conn : pyodbc.Connection
        An open database connection.

    Returns
    -------
    list[str]
        Table names, excluding system tables.
    """
    cursor = conn.cursor()
    tables = []
    for row in cursor.tables(tableType="TABLE"):
        name = row.table_name
        if not name.startswith("MSys"):
            tables.append(name)
    return sorted(tables)


def list_columns(conn: pyodbc.Connection, table_name: str) -> list[dict[str, str]]:
    """List columns and their types for a given table.

    Parameters
    ----------
    conn : pyodbc.Connection
        An open database connection.
    table_name : str
        Name of the table to inspect.

    Returns
    -------
    list[dict[str, str]]
        List of dicts with 'name' and 'type_name' keys.
    """
    cursor = conn.cursor()
    columns = []
    for row in cursor.columns(table=table_name):
        columns.append({"name": row.column_name, "type_name": row.type_name})
    return columns


def read_table(conn: pyodbc.Connection, table_name: str) -> list[dict]:
    """Read all rows from a table as a list of dicts.

    Parameters
    ----------
    conn : pyodbc.Connection
        An open database connection.
    table_name : str
        Name of the table to read.

    Returns
    -------
    list[dict]
        Each row as a dictionary keyed by column name.
    """
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM [{table_name}]")  # noqa: S608
    col_names = [desc[0] for desc in cursor.description]
    rows = []
    for row in cursor.fetchall():
        rows.append(dict(zip(col_names, row, strict=True)))
    return rows
