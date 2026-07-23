import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

/**
 * DateTimePicker stylé façon glassmorphism
 * @param {Object} props
 * @param {Date|null} props.value
 * @param {(date: Date|null) => void} props.onChange
 * @param {string} props.placeholder
 * @param {string} [props.className]
 */
export default function DateTimePicker({ value, onChange, placeholder, className = "" }) {
  return (
    <DatePicker
      selected={value}
      onChange={onChange}
      showTimeSelect
      timeIntervals={15}
      dateFormat="dd/MM/yyyy HH:mm"
      placeholderText={placeholder}
      className={className ? `dd-input ${className}` : "dd-input"}
      calendarClassName="dd-calendar"
      popperClassName="dd-popper"
    />
  );
}
