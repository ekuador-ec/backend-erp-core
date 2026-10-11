function buildDynamicUpdateQuery(
  table: string,
  idColumn: string,
  idValue: string | number,
  fieldsToUpdate: Record<string, unknown>,
  allowedFields: string[],
): { query: string; values: unknown[] } {
  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const [field, value] of Object.entries(fieldsToUpdate)) {
    if (!allowedFields.includes(field)) {
      continue;
    }

    if (value === undefined) {
      continue;
    }

    assignments.push(`${field} = $${values.length + 1}`);
    values.push(value);
  }

  if (assignments.length === 0) {
    throw new Error('No hay campos para actualizar');
  }

  values.push(idValue);

  const query = `UPDATE ${table} SET ${assignments.join(', ')} WHERE ${idColumn} = $${values.length}`;

  return { query, values };
}

export { buildDynamicUpdateQuery };
