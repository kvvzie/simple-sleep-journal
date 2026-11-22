import { FontVariant } from "@/lib/theme-utils";
import { ThemePaletteColors } from "@/types/appearance";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AnimatedRadioDot from "../animated-radio-dot";
import { styles } from "./sleep-modal.styles";
import { formatTodoElapsedHours, TodoTask } from "./todo.utils";

type Props = {
  todos: TodoTask[];
  colors: ThemePaletteColors;
  scheme: "light" | "dark";
  resolveFont: (variant: FontVariant) => string;
  nowMs: number;
  resetKey: number;
  onAddTodo: (title: string) => Promise<void>;
  onToggleTodo: (todo: TodoTask) => Promise<void>;
  onEditTodo: (todo: TodoTask, nextTitle: string) => Promise<void>;
  onRequestDeleteTodo: (todo: TodoTask) => void;
  onInputFocus: () => void;
};

export default function TodoListSection({
  todos,
  colors,
  scheme,
  resolveFont,
  nowMs,
  resetKey,
  onAddTodo,
  onToggleTodo,
  onEditTodo,
  onRequestDeleteTodo,
  onInputFocus,
}: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const newDraftRef = useRef("");
  const isAddingRef = useRef(false);
  const addHandledRef = useRef(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const editDraftRef = useRef("");
  const editingIdRef = useRef<string | null>(null);
  const editHandledRef = useRef(false);

  useEffect(() => {
    isAddingRef.current = isAdding;
  }, [isAdding]);

  useEffect(() => {
    editingIdRef.current = editingId;
  }, [editingId]);

  useEffect(() => {
    isAddingRef.current = false;
    addHandledRef.current = false;
    newDraftRef.current = "";
    setIsAdding(false);
    setNewTaskText("");
    editingIdRef.current = null;
    editHandledRef.current = false;
    editDraftRef.current = "";
    setEditingId(null);
    setEditText("");
  }, [resetKey]);

  const commitAdd = async () => {
    if (addHandledRef.current || !isAddingRef.current) return;
    addHandledRef.current = true;
    const trimmed = newDraftRef.current.trim();
    isAddingRef.current = false;
    setIsAdding(false);
    setNewTaskText("");
    newDraftRef.current = "";
    Keyboard.dismiss();
    if (trimmed.length > 0) {
      await onAddTodo(trimmed);
    }
  };

  const commitEdit = async () => {
    const activeId = editingIdRef.current;
    if (editHandledRef.current || !activeId) return;
    editHandledRef.current = true;
    const target = todos.find((t) => t.id === activeId);
    const trimmed = editDraftRef.current.trim();
    editingIdRef.current = null;
    setEditingId(null);
    setEditText("");
    editDraftRef.current = "";
    Keyboard.dismiss();
    if (target && trimmed.length > 0 && trimmed !== target.title) {
      await onEditTodo(target, trimmed);
    }
  };

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      if (isAddingRef.current) {
        void commitAdd();
      } else if (editingIdRef.current !== null) {
        void commitEdit();
      }
    });
    return () => sub.remove();
  }, [todos]);

  const startAdding = () => {
    if (editingIdRef.current !== null) {
      void commitEdit();
    }
    addHandledRef.current = false;
    isAddingRef.current = true;
    newDraftRef.current = "";
    setNewTaskText("");
    setIsAdding(true);
    onInputFocus();
  };

  const startEditing = (todo: TodoTask) => {
    if (isAddingRef.current) {
      void commitAdd();
    }
    editHandledRef.current = false;
    editingIdRef.current = todo.id;
    editDraftRef.current = todo.title;
    setEditText(todo.title);
    setEditingId(todo.id);
    onInputFocus();
  };

  const deleteIconColor = scheme === "dark" ? "#C25E5E" : "#B84747";

  return (
    <View style={styles.todoSection}>
      <Text
        style={[
          styles.label,
          {
            color: colors.textSecondary,
            fontFamily: resolveFont("italic"),
          },
        ]}
      >
        to do list
      </Text>

      <View style={styles.todoListContainer}>
        {todos.map((todo) => {
          const isCompleted = todo.completed_date !== null;
          const isEditing = editingId === todo.id;

          return (
            <View key={todo.id} style={styles.todoRow}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  if (!isEditing) {
                    void onToggleTodo(todo);
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 6 }}
                style={styles.todoIconButton}
              >
                <AnimatedRadioDot
                  checked={isCompleted}
                  size={22}
                  color={colors.text}
                  snapKey={resetKey}
                />
              </TouchableOpacity>

              <View style={styles.todoTitleBox}>
                {isEditing ? (
                  <TextInput
                    value={editText}
                    onChangeText={(text) => {
                      editDraftRef.current = text;
                      setEditText(text);
                    }}
                    autoFocus
                    multiline
                    submitBehavior="blurAndSubmit"
                    returnKeyType="done"
                    onSubmitEditing={() => void commitEdit()}
                    onBlur={() => void commitEdit()}
                    onFocus={onInputFocus}
                    style={[
                      styles.todoInlineInput,
                      {
                        color: colors.text,
                        borderBottomColor: colors.textSecondary,
                        fontFamily: resolveFont("regular"),
                      },
                    ]}
                  />
                ) : (
                  <Text
                    key={`${todo.id}-${isCompleted ? "done" : "open"}`}
                    style={[
                      styles.todoTitleText,
                      {
                        color: isCompleted ? colors.textSecondary : colors.text,
                        fontFamily: resolveFont("regular"),
                        textDecorationLine: isCompleted
                          ? "line-through"
                          : "none",
                        textDecorationStyle: "solid",
                        textDecorationColor: isCompleted
                          ? colors.textSecondary
                          : undefined,
                      },
                    ]}
                  >
                    {todo.title}
                  </Text>
                )}
              </View>

              <View style={styles.todoTimestampCluster}>
                <Ionicons
                  name="hourglass-outline"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text
                  style={[
                    styles.todoTimestampText,
                    {
                      color: colors.textSecondary,
                      fontFamily: resolveFont("italic"),
                    },
                  ]}
                >
                  {formatTodoElapsedHours(todo.created_at, nowMs)}
                </Text>
              </View>

              {isEditing ? (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => void commitEdit()}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  style={styles.todoIconButton}
                >
                  <Ionicons name="checkmark" size={21} color={colors.text} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => startEditing(todo)}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  style={styles.todoIconButton}
                >
                  <Feather name="edit-2" size={19} color={colors.text} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  if (editingIdRef.current === todo.id) {
                    editHandledRef.current = true;
                    editingIdRef.current = null;
                    setEditingId(null);
                  }
                  Keyboard.dismiss();
                  onRequestDeleteTodo(todo);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                style={styles.todoIconButton}
              >
                <Ionicons name="trash" size={20} color={deleteIconColor} />
              </TouchableOpacity>
            </View>
          );
        })}

        {isAdding ? (
          <View style={styles.todoAddRow}>
            <View style={styles.todoIconButton}>
              <Ionicons name="add" size={22} color={colors.textSecondary} />
            </View>
            <View style={styles.todoTitleBox}>
              <TextInput
                value={newTaskText}
                onChangeText={(text) => {
                  newDraftRef.current = text;
                  setNewTaskText(text);
                }}
                autoFocus
                multiline
                submitBehavior="blurAndSubmit"
                placeholder="new task"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
                onSubmitEditing={() => void commitAdd()}
                onBlur={() => void commitAdd()}
                onFocus={onInputFocus}
                style={[
                  styles.todoInlineInput,
                  {
                    color: colors.text,
                    borderBottomColor: colors.textSecondary,
                    fontFamily: resolveFont("regular"),
                  },
                ]}
              />
            </View>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => void commitAdd()}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
              style={styles.todoIconButton}
            >
              <Ionicons name="checkmark" size={21} color={colors.text} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={startAdding}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            style={styles.todoAddRow}
          >
            <Ionicons name="add" size={22} color={colors.textSecondary} />
            <Text
              style={[
                styles.todoAddText,
                {
                  color: colors.textSecondary,
                  fontFamily: resolveFont("regular"),
                },
              ]}
            >
              new task
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
