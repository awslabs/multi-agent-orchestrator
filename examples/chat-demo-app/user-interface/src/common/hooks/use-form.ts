import { useCallback, useState } from "react";
import { Utils } from "../utils";

export interface UseFormProps<T> {
  initialValue: T | (() => T);
  validate: (form: T) => Record<string, string | string[]> | null;
}

export function useForm<T>(props: UseFormProps<T>) {
  const [initialProps] = useState(props);
  const [data, setData] = useState(() => {
    const value = Utils.isFunction(props.initialValue)
      ? props.initialValue()
      : props.initialValue;

    return {
      dirty: false,
      value,
    };
  });
  const [errors, setErrors] = useState<Record<string, string | string[]>>({});

  const validate = useCallback(() => {
    const errors = initialProps.validate(data.value);
    setErrors(errors ?? {});
    setData((current) => ({ ...current, dirty: true }));

    return errors === null || Object.keys(errors).length === 0;
  }, [data, initialProps]);

  const onChange = useCallback(
    (partial: Partial<T>, resetDirty = false) => {
      setData((current) => {
        let dirty = current.dirty;
        if (resetDirty) {
          dirty = false;
        }

        const updatedData = {
          ...current,
          dirty,
          value: { ...current.value, ...partial },
        };

        if (dirty) {
          const errors = initialProps.validate(updatedData.value);
          setErrors(errors ?? {});
        }

        return updatedData;
      });
    },
    [initialProps]
  );

  return { data: data.value, onChange, errors, validate };
}
