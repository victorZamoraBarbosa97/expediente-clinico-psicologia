ALTER TABLE pacientes ADD COLUMN antecedentes_familiares_medicos TEXT;
              ALTER TABLE pacientes ADD COLUMN antecedentes_familiares_psicologicos TEXT;
              UPDATE pacientes SET antecedentes_familiares_psicologicos = antecedentes_familiares
                WHERE antecedentes_familiares IS NOT NULL;
              ALTER TABLE pacientes DROP COLUMN antecedentes_familiares;